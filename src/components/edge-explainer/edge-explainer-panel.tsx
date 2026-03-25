"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, BarChart3, Target, Brain } from "lucide-react";
import { Prop } from "@/types";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { GameLogChart } from "@/components/charts/game-log-chart";
import { FactorWaterfall } from "@/components/charts/factor-waterfall";
import { ProbabilityBar } from "@/components/charts/probability-bar";
import { generateReasoning, probToAmericanOdds } from "@/lib/edge-calculator";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  prop: Prop | null;
  onClose: () => void;
}

export function EdgeExplainerPanel({ prop, onClose }: Props) {
  if (!prop) return null;

  const stats = prop.playerStats;
  const reasoning = stats ? generateReasoning(prop, stats) : "";
  const fairOdds = probToAmericanOdds(prop.trueProb);
  const gameLog = stats?.gameLog || [];
  const hitCount = gameLog.filter((g) => g.value >= prop.line).length;
  const hitRate = gameLog.length > 0 ? (hitCount / gameLog.length) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-[#0d1117] border-l border-white/5 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#0d1117]/95 backdrop-blur-xl border-b border-white/5 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    className={
                      prop.recommendation === "STRONG"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : prop.recommendation === "LEAN"
                        ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                        : prop.recommendation === "FADE"
                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                    }
                  >
                    {prop.recommendation}
                  </Badge>
                  <Badge variant="outline" className="text-xs border-white/10">
                    {prop.platform.toUpperCase()}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold">{prop.playerName}</h2>
                <p className="text-gray-400 text-sm">
                  {prop.statType} O{prop.line} &middot;{" "}
                  {prop.team} {prop.isHome ? "vs" : "@"} {prop.opponent}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Key metrics row */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              {[
                {
                  label: "Edge",
                  value: `${(prop.edge * 100).toFixed(1)}%`,
                  color: prop.edge > 0 ? "text-green-400" : "text-red-400",
                },
                {
                  label: "EV",
                  value: `${(prop.ev * 100).toFixed(1)}%`,
                  color: prop.ev > 0 ? "text-green-400" : "text-red-400",
                },
                {
                  label: "Fair Odds",
                  value: `${fairOdds > 0 ? "+" : ""}${fairOdds}`,
                  color: "text-orange-400",
                },
                {
                  label: "Confidence",
                  value: `${prop.confidence}`,
                  color:
                    prop.confidence >= 60
                      ? "text-green-400"
                      : prop.confidence >= 40
                      ? "text-yellow-400"
                      : "text-red-400",
                },
              ].map((m) => (
                <div key={m.label} className="glass rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {m.label}
                  </div>
                  <div className={`font-mono-nums text-lg font-bold ${m.color}`}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-5 space-y-6">
            {/* WHY — Plain English */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-orange-400" />
                <h3 className="font-semibold text-sm">Why This Edge Exists</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{reasoning}</p>
            </div>

            <Tabs defaultValue="distribution" className="w-full">
              <TabsList className="bg-white/[0.03] border border-white/5 w-full">
                <TabsTrigger value="distribution" className="flex-1 text-xs">
                  Distribution
                </TabsTrigger>
                <TabsTrigger value="gamelog" className="flex-1 text-xs">
                  Game Log
                </TabsTrigger>
                <TabsTrigger value="factors" className="flex-1 text-xs">
                  Factors
                </TabsTrigger>
                <TabsTrigger value="model" className="flex-1 text-xs">
                  Model
                </TabsTrigger>
              </TabsList>

              {/* Distribution Curve */}
              <TabsContent value="distribution" className="mt-4">
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-orange-400" />
                    <h3 className="font-semibold text-sm">Probability Distribution</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Green area = probability of going OVER the line. Orange dashed = the line.
                  </p>
                  {prop.modelDetails?.distributionData && stats && (
                    <DistributionChart
                      data={prop.modelDetails.distributionData}
                      line={prop.line}
                      mean={stats.seasonAvg}
                      height={240}
                    />
                  )}
                  <div className="mt-3">
                    <ProbabilityBar
                      modelProb={prop.trueProb}
                      impliedProb={prop.impliedProb}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Game Log */}
              <TabsContent value="gamelog" className="mt-4">
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-orange-400" />
                      <h3 className="font-semibold text-sm">Recent Game Log</h3>
                    </div>
                    <span className="font-mono-nums text-xs text-gray-400">
                      Hit rate: {hitRate.toFixed(0)}% ({hitCount}/{gameLog.length})
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Green bars = over the line. Orange = 5-game avg. Purple = 10-game avg.
                  </p>
                  {gameLog.length > 0 && (
                    <GameLogChart gameLog={gameLog} line={prop.line} height={260} />
                  )}

                  {/* Splits */}
                  {stats && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-white/[0.03] rounded-lg p-3">
                        <div className="text-[10px] text-gray-500 uppercase">Home Avg</div>
                        <div className="font-mono-nums text-lg font-bold">
                          {stats.homeAvg.toFixed(1)}
                        </div>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg p-3">
                        <div className="text-[10px] text-gray-500 uppercase">Away Avg</div>
                        <div className="font-mono-nums text-lg font-bold">
                          {stats.awayAvg.toFixed(1)}
                        </div>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg p-3">
                        <div className="text-[10px] text-gray-500 uppercase">Last 5 Avg</div>
                        <div className="font-mono-nums text-lg font-bold text-orange-400">
                          {stats.last5Avg.toFixed(1)}
                        </div>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg p-3">
                        <div className="text-[10px] text-gray-500 uppercase">Last 10 Avg</div>
                        <div className="font-mono-nums text-lg font-bold">
                          {stats.last10Avg.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Adjustment Factors */}
              <TabsContent value="factors" className="mt-4">
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-orange-400" />
                    <h3 className="font-semibold text-sm">Adjustment Factors</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    How each factor shifted the probability from base model to final.
                  </p>
                  {prop.adjustments?.factors && (
                    <FactorWaterfall factors={prop.adjustments.factors} />
                  )}
                </div>
              </TabsContent>

              {/* Model Details */}
              <TabsContent value="model" className="mt-4">
                <div className="glass rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="h-4 w-4 text-orange-400" />
                    <h3 className="font-semibold text-sm">Ensemble Model Breakdown</h3>
                  </div>

                  {prop.modelDetails && (
                    <div className="space-y-3">
                      {[
                        {
                          label: "Normal Distribution",
                          prob: prop.modelDetails.normalProb,
                          weight: prop.modelDetails.normalWeight,
                          color: "#f97316",
                          desc: "Bell curve model with continuity correction",
                        },
                        {
                          label: "Poisson Distribution",
                          prob: prop.modelDetails.poissonProb,
                          weight: prop.modelDetails.poissonWeight,
                          color: "#818cf8",
                          desc: "Count-based model for discrete low-count stats",
                        },
                        {
                          label: "Skew-Adjusted",
                          prob: prop.modelDetails.skewAdjustedProb,
                          weight: prop.modelDetails.skewWeight,
                          color: "#22c55e",
                          desc: "Cornish-Fisher expansion accounting for asymmetry",
                        },
                      ].map((model) => (
                        <div
                          key={model.label}
                          className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-3"
                        >
                          <div
                            className="w-1 h-10 rounded-full"
                            style={{ background: model.color }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{model.label}</span>
                              <span className="font-mono-nums text-sm text-white">
                                {(model.prob * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[11px] text-gray-500">{model.desc}</span>
                              <span className="font-mono-nums text-[11px] text-gray-400">
                                Weight: {(model.weight * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}

                      <Separator className="bg-white/5" />

                      <div className="flex items-center justify-between bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
                        <span className="text-sm font-semibold">Ensemble Result</span>
                        <span className="font-mono-nums text-lg font-bold text-orange-400">
                          {(prop.modelDetails.ensembleProb * 100).toFixed(1)}%
                        </span>
                      </div>

                      {stats && (
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>
                            Bayesian posterior mean:{" "}
                            <span className="font-mono-nums text-gray-300">
                              {stats.seasonAvg.toFixed(1)}
                            </span>{" "}
                            (season) blended with{" "}
                            <span className="font-mono-nums text-gray-300">
                              {stats.last5Avg.toFixed(1)}
                            </span>{" "}
                            (L5)
                          </p>
                          <p>
                            Sample: {stats.gamesPlayed} games &middot; StdDev:{" "}
                            <span className="font-mono-nums">{stats.stdDev.toFixed(1)}</span>{" "}
                            &middot; CV:{" "}
                            <span className="font-mono-nums">
                              {((stats.stdDev / (stats.seasonAvg + 0.01)) * 100).toFixed(0)}%
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
