"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { getDemoProps } from "@/lib/demo-data";
import { GameLogChart } from "@/components/charts/game-log-chart";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function PlayerPage() {
  const params = useParams();
  const id = params.id as string;

  const prop = useMemo(() => {
    const props = getDemoProps();
    return props.find((p) => p.id === id) || props[0];
  }, [id]);

  const stats = prop?.playerStats;
  if (!stats) {
    return (
      <div className="pt-10 text-center text-gray-500">Player not found</div>
    );
  }

  const gameLog = stats.gameLog;
  const values = gameLog.map((g) => g.value);

  // Build histogram
  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  const bucketSize = Math.max(1, Math.round((max - min) / 15));
  const histogram: { range: string; count: number; mid: number }[] = [];
  for (let b = min; b <= max; b += bucketSize) {
    const count = values.filter((v) => v >= b && v < b + bucketSize).length;
    histogram.push({
      range: `${b}-${b + bucketSize - 1}`,
      count,
      mid: b + bucketSize / 2,
    });
  }

  const homeGames = gameLog.filter((g) => g.isHome);
  const awayGames = gameLog.filter((g) => !g.isHome);
  const homeAvg = homeGames.length
    ? homeGames.reduce((s, g) => s + g.value, 0) / homeGames.length
    : 0;
  const awayAvg = awayGames.length
    ? awayGames.reduce((s, g) => s + g.value, 0) / awayGames.length
    : 0;

  return (
    <div className="space-y-6 pt-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">{stats.playerName}</h1>
          <Badge variant="outline" className="border-orange-500/30 text-orange-400">
            {stats.statType}
          </Badge>
        </div>
        <p className="text-gray-400 text-sm">
          {prop.team} &middot; {stats.sport.toUpperCase()} &middot; {stats.gamesPlayed} games played
        </p>
      </motion.div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Season Avg", value: stats.seasonAvg.toFixed(1) },
          { label: "Std Dev", value: stats.stdDev.toFixed(1) },
          { label: "Last 5", value: stats.last5Avg.toFixed(1), accent: true },
          { label: "Last 10", value: stats.last10Avg.toFixed(1) },
          { label: "Home Avg", value: homeAvg.toFixed(1) },
          { label: "Away Avg", value: awayAvg.toFixed(1) },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4 text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</div>
            <div
              className={`font-mono-nums text-xl font-bold mt-1 ${
                s.accent ? "text-orange-400" : "text-white"
              }`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Game Log Chart */}
      <div className="glass rounded-xl p-5">
        <h2 className="font-semibold mb-1">Game Log</h2>
        <p className="text-xs text-gray-500 mb-3">
          Last {gameLog.length} games. Orange = 5-game rolling avg. Purple = 10-game.
        </p>
        <GameLogChart gameLog={gameLog} line={prop.line} height={300} />
      </div>

      {/* Distribution */}
      {prop.modelDetails?.distributionData && (
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-1">Distribution</h2>
          <p className="text-xs text-gray-500 mb-3">
            Model probability density. Green = over. Red = under.
          </p>
          <DistributionChart
            data={prop.modelDetails.distributionData}
            line={prop.line}
            mean={stats.seasonAvg}
            height={280}
          />
        </div>
      )}

      {/* Game Log Table */}
      <div className="glass rounded-xl p-5">
        <h2 className="font-semibold mb-3">Full Game Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-white/5">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Opp</th>
                <th className="pb-2 pr-4">H/A</th>
                <th className="pb-2 pr-4 text-right">{stats.statType}</th>
                <th className="pb-2 pr-4 text-right">Min</th>
                <th className="pb-2 text-right">vs Line ({prop.line})</th>
              </tr>
            </thead>
            <tbody>
              {[...gameLog].reverse().map((g, i) => (
                <tr
                  key={i}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                >
                  <td className="py-2 pr-4 font-mono-nums text-xs text-gray-400">
                    {g.date}
                  </td>
                  <td className="py-2 pr-4 text-xs">{g.opponent}</td>
                  <td className="py-2 pr-4 text-xs text-gray-400">
                    {g.isHome ? "Home" : "Away"}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono-nums font-medium">
                    {g.value}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono-nums text-xs text-gray-400">
                    {g.minutes || "-"}
                  </td>
                  <td className="py-2 text-right">
                    {g.value >= prop.line ? (
                      <span className="text-green-400 font-mono-nums text-xs font-medium">
                        OVER (+{(g.value - prop.line).toFixed(1)})
                      </span>
                    ) : (
                      <span className="text-red-400 font-mono-nums text-xs">
                        UNDER ({(g.value - prop.line).toFixed(1)})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
