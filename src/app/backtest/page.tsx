"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  Cell,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getDemoBetHistory, getDemoDailySummaries } from "@/lib/demo-data";
import { PnlChart } from "@/components/charts/pnl-chart";
import type {
  Bet,
  ConfidenceTierStats,
  CalibrationPoint,
} from "@/types";

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

function computeMetrics(bets: Bet[]) {
  const settled = bets.filter((b) => b.outcome === "win" || b.outcome === "loss");
  const wins = settled.filter((b) => b.outcome === "win").length;
  const totalBets = settled.length;
  const hitRate = totalBets > 0 ? wins / totalBets : 0;
  const totalPnl = settled.reduce((s, b) => s + b.pnl, 0);
  const totalWagered = settled.reduce((s, b) => s + b.betAmount, 0);
  const roi = totalWagered > 0 ? totalPnl / totalWagered : 0;

  const brierScore =
    totalBets > 0
      ? settled.reduce((s, b) => {
          const predicted = b.prop?.trueProb ?? 0.5;
          const outcome = b.outcome === "win" ? 1 : 0;
          return s + (predicted - outcome) ** 2;
        }, 0) / totalBets
      : 0;

  const byDate = new Map<string, number>();
  for (const b of settled) {
    const d = b.createdAt.split("T")[0];
    byDate.set(d, (byDate.get(d) ?? 0) + b.pnl);
  }
  const dates = [...byDate.keys()].sort();
  const dailyPnls = dates.map((d) => byDate.get(d)!);

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const pnlCurve: { date: string; value: number }[] = [];
  for (const d of dates) {
    cumulative += byDate.get(d)!;
    pnlCurve.push({ date: d.slice(5), value: Math.round(cumulative * 100) / 100 });
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const meanDaily = dailyPnls.length > 0 ? dailyPnls.reduce((a, b) => a + b, 0) / dailyPnls.length : 0;
  const variance =
    dailyPnls.length > 1
      ? dailyPnls.reduce((s, v) => s + (v - meanDaily) ** 2, 0) / (dailyPnls.length - 1)
      : 0;
  const stdDaily = Math.sqrt(variance);
  const sharpeRatio = stdDaily > 0 ? (meanDaily / stdDaily) * Math.sqrt(252) : 0;

  const tiers: ConfidenceTierStats[] = [
    { tier: "0–30", range: [0, 30], count: 0, hitRate: 0, avgEdge: 0, roi: 0 },
    { tier: "30–50", range: [30, 50], count: 0, hitRate: 0, avgEdge: 0, roi: 0 },
    { tier: "50–70", range: [50, 70], count: 0, hitRate: 0, avgEdge: 0, roi: 0 },
    { tier: "70–100", range: [70, 100], count: 0, hitRate: 0, avgEdge: 0, roi: 0 },
  ];
  for (const t of tiers) {
    const inTier = settled.filter(
      (b) => (b.prop?.confidence ?? 0) >= t.range[0] && (b.prop?.confidence ?? 0) < t.range[1]
    );
    t.count = inTier.length;
    const tierWins = inTier.filter((b) => b.outcome === "win").length;
    t.hitRate = t.count > 0 ? tierWins / t.count : 0;
    t.avgEdge =
      t.count > 0 ? inTier.reduce((s, b) => s + b.edgeAtBet, 0) / t.count : 0;
    const tierWagered = inTier.reduce((s, b) => s + b.betAmount, 0);
    const tierPnl = inTier.reduce((s, b) => s + b.pnl, 0);
    t.roi = tierWagered > 0 ? tierPnl / tierWagered : 0;
  }

  const bins: CalibrationPoint[] = [];
  for (let i = 0; i < 10; i++) {
    const lo = i / 10;
    const hi = (i + 1) / 10;
    const inBin = settled.filter((b) => {
      const p = b.prop?.trueProb ?? 0.5;
      return p >= lo && p < hi;
    });
    if (inBin.length >= 1) {
      const actual = inBin.filter((b) => b.outcome === "win").length / inBin.length;
      bins.push({
        predictedProb: Math.round((lo + hi) / 2 * 100),
        actualRate: Math.round(actual * 100),
        count: inBin.length,
      });
    }
  }

  const byStatType = new Map<string, { pnl: number; wagered: number }>();
  for (const b of settled) {
    const st = b.prop?.statType ?? "Unknown";
    const prev = byStatType.get(st) ?? { pnl: 0, wagered: 0 };
    prev.pnl += b.pnl;
    prev.wagered += b.betAmount;
    byStatType.set(st, prev);
  }
  const roiByStat = [...byStatType.entries()].map(([stat, v]) => ({
    stat,
    roi: v.wagered > 0 ? Math.round((v.pnl / v.wagered) * 10000) / 100 : 0,
    pnl: Math.round(v.pnl * 100) / 100,
  }));
  roiByStat.sort((a, b) => b.roi - a.roi);

  return {
    totalBets,
    hitRate,
    totalPnl: Math.round(totalPnl * 100) / 100,
    roi,
    brierScore: Math.round(brierScore * 10000) / 10000,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    tiers,
    calibrationData: bins,
    pnlCurve,
    roiByStat,
  };
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}

function StatCard({ label, value, sub, positive }: StatCardProps) {
  return (
    <motion.div variants={fadeUp} className="glass rounded-xl p-4 flex flex-col gap-1">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span
        className={`text-xl font-bold font-mono-nums ${
          positive === true ? "text-green-400" : positive === false ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </span>
      {sub && <span className="text-[11px] text-gray-500 font-mono-nums">{sub}</span>}
    </motion.div>
  );
}

export default function BacktestPage() {
  const bets = useMemo(() => getDemoBetHistory(), []);
  const dailySummaries = useMemo(() => getDemoDailySummaries(), []);
  const metrics = useMemo(() => computeMetrics(bets), [bets]);

  const sortedDaily = useMemo(
    () => [...dailySummaries].sort((a, b) => b.date.localeCompare(a.date)),
    [dailySummaries]
  );

  return (
    <div className="space-y-8 pt-6 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold tracking-tight">
          Performance
          <span className="ml-2 text-sm font-normal text-gray-500">Last 30 days</span>
        </h1>
      </motion.div>

      {/* Summary stat cards */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <StatCard
          label="Total P&L"
          value={`${metrics.totalPnl >= 0 ? "+" : ""}$${metrics.totalPnl.toLocaleString()}`}
          positive={metrics.totalPnl >= 0}
        />
        <StatCard
          label="Win Rate"
          value={`${(metrics.hitRate * 100).toFixed(1)}%`}
          sub={`${Math.round(metrics.hitRate * metrics.totalBets)}W – ${metrics.totalBets - Math.round(metrics.hitRate * metrics.totalBets)}L`}
        />
        <StatCard
          label="Total Bets"
          value={metrics.totalBets.toString()}
        />
        <StatCard
          label="Brier Score"
          value={metrics.brierScore.toFixed(4)}
          sub="Lower is better"
        />
        <StatCard
          label="Max Drawdown"
          value={`-$${metrics.maxDrawdown.toLocaleString()}`}
          positive={false}
        />
        <StatCard
          label="Sharpe Ratio"
          value={metrics.sharpeRatio.toFixed(2)}
          positive={metrics.sharpeRatio > 0}
        />
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-1">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="calibration" className="text-xs">Calibration</TabsTrigger>
          <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass rounded-xl p-5"
          >
            <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-4">
              Cumulative P&L
            </h3>
            <PnlChart data={metrics.pnlCurve} height={320} label="Cumulative P&L" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass rounded-xl p-5"
          >
            <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-4">
              ROI by Stat Type
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(200, metrics.roiByStat.length * 48)}>
              <BarChart
                data={metrics.roiByStat}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="stat"
                  tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, "ROI"]}
                  cursor={{ fill: "rgba(255,255,255,0.02)" }}
                />
                <Bar dataKey="roi" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {metrics.roiByStat.map((entry, i) => (
                    <Cell key={i} fill={entry.roi >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </TabsContent>

        {/* Calibration Tab */}
        <TabsContent value="calibration" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass rounded-xl p-5"
            >
              <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                Calibration Plot
              </h3>
              <p className="text-[11px] text-gray-600 mb-4">
                Predicted probability vs. actual hit rate — closer to the diagonal is better
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis
                    dataKey="predictedProb"
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    tickFormatter={(v) => `${v}%`}
                    label={{
                      value: "Predicted",
                      position: "insideBottom",
                      offset: -4,
                      fontSize: 10,
                      fill: "rgba(255,255,255,0.3)",
                    }}
                  />
                  <YAxis
                    dataKey="actualRate"
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickFormatter={(v) => `${v}%`}
                    label={{
                      value: "Actual",
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                      fontSize: 10,
                      fill: "rgba(255,255,255,0.3)",
                    }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [
                      `${value}%`,
                      name === "actualRate" ? "Actual" : "Perfect",
                    ]}
                    labelFormatter={(l) => `Predicted: ${l}%`}
                  />
                  <ReferenceLine
                    segment={[
                      { x: 0, y: 0 },
                      { x: 100, y: 100 },
                    ]}
                    stroke="rgba(255,255,255,0.12)"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                  />
                  <Line
                    data={metrics.calibrationData}
                    type="monotone"
                    dataKey="actualRate"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ r: 5, fill: "#f97316", strokeWidth: 0 }}
                    activeDot={{ r: 7, fill: "#f97316" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass rounded-xl p-5"
            >
              <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                Hit Rate by Confidence Tier
              </h3>
              <p className="text-[11px] text-gray-600 mb-4">
                Model accuracy across confidence buckets
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={metrics.tiers.map((t) => ({
                    ...t,
                    hitRatePct: Math.round(t.hitRate * 1000) / 10,
                    label: t.tier,
                  }))}
                  margin={{ top: 10, right: 10, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, "Hit Rate"]}
                    labelFormatter={(l) => `Confidence: ${l}%`}
                    cursor={{ fill: "rgba(255,255,255,0.02)" }}
                  />
                  <Bar dataKey="hitRatePct" radius={[4, 4, 0, 0]} maxBarSize={52}>
                    {metrics.tiers.map((_, i) => (
                      <Cell key={i} fill="#22c55e" fillOpacity={0.7 + i * 0.08} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-4 gap-2 mt-4">
                {metrics.tiers.map((t) => (
                  <div key={t.tier} className="text-center">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">{t.tier}%</div>
                    <div className="font-mono-nums text-xs text-white mt-0.5">{t.count} bets</div>
                    <div className={`font-mono-nums text-xs mt-0.5 ${t.roi >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {t.roi >= 0 ? "+" : ""}{(t.roi * 100).toFixed(1)}% ROI
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </TabsContent>

        {/* Daily Tab */}
        <TabsContent value="daily" className="mt-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass rounded-xl overflow-hidden"
          >
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-[10px] text-gray-500 uppercase tracking-wider">
                Daily Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Date", "Bets", "W-L", "P&L", "ROI", "Avg Edge", "Avg Conf"].map((h) => (
                      <th
                        key={h}
                        className="text-[10px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3 text-left first:pl-5 last:pr-5"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedDaily.map((day, i) => (
                    <motion.tr
                      key={day.date}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3 font-mono-nums text-gray-300 text-xs">
                        {day.date}
                      </td>
                      <td className="px-5 py-3 font-mono-nums text-xs">{day.totalBets}</td>
                      <td className="px-5 py-3 font-mono-nums text-xs">
                        <span className="text-green-400">{day.wins}</span>
                        <span className="text-gray-600">–</span>
                        <span className="text-red-400">{day.losses}</span>
                      </td>
                      <td
                        className={`px-5 py-3 font-mono-nums text-xs font-medium ${
                          day.pnl >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {day.pnl >= 0 ? "+" : ""}${day.pnl.toFixed(2)}
                      </td>
                      <td
                        className={`px-5 py-3 font-mono-nums text-xs ${
                          day.roi >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {day.roi >= 0 ? "+" : ""}{day.roi.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3 font-mono-nums text-xs text-gray-400">
                        {day.avgEdge.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3 font-mono-nums text-xs text-gray-400">
                        {day.avgConfidence}%
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
