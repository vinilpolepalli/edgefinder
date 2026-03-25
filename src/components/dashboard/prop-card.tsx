"use client";

import { motion } from "framer-motion";
import { Prop } from "@/types";
import { Badge } from "@/components/ui/badge";
import { probToAmericanOdds } from "@/lib/edge-calculator";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  prop: Prop;
  index: number;
  onClick: () => void;
}

export function PropCard({ prop, index, onClick }: Props) {
  const isStrong = prop.recommendation === "STRONG";
  const fairOdds = probToAmericanOdds(prop.trueProb);
  const edgePct = (prop.edge * 100).toFixed(1);
  const evPct = (prop.ev * 100).toFixed(1);
  const kellyPct = (prop.kelly * 100).toFixed(2);

  const gameTime = new Date(prop.gameTime);
  const timeStr = gameTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={onClick}
      className={`group cursor-pointer rounded-xl border transition-all duration-300 hover:scale-[1.01] ${
        isStrong
          ? "glass-strong glow-green border-green-500/20 hover:border-green-500/40"
          : "glass border-white/5 hover:border-white/10"
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Top row: player + badges */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white truncate">{prop.playerName}</h3>
              <Badge
                className={
                  prop.recommendation === "STRONG"
                    ? "bg-green-500/20 text-green-400 border-green-500/30 text-[10px]"
                    : prop.recommendation === "LEAN"
                    ? "bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]"
                    : prop.recommendation === "FADE"
                    ? "bg-red-500/20 text-red-400 border-red-500/30 text-[10px]"
                    : "bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]"
                }
              >
                {prop.recommendation}
              </Badge>
            </div>
            <p className="text-sm text-gray-400">
              {prop.team} {prop.isHome ? "vs" : "@"} {prop.opponent} &middot; {timeStr}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] border-white/10 shrink-0 ml-2">
            {prop.platform.toUpperCase()}
          </Badge>
        </div>

        {/* Stat line */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-orange-500/10 rounded-lg px-3 py-1.5 border border-orange-500/20">
            <span className="font-mono-nums text-sm font-bold text-orange-400">
              {prop.statType} O{prop.line}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Market: {prop.marketOdds > 0 ? "+" : ""}
            {prop.marketOdds} &rarr; Fair:{" "}
            <span className="text-orange-400">
              {fairOdds > 0 ? "+" : ""}
              {fairOdds}
            </span>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Edge</div>
            <div
              className={`font-mono-nums text-sm font-bold ${
                prop.edge > 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {prop.edge > 0 ? "+" : ""}
              {edgePct}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">EV</div>
            <div
              className={`font-mono-nums text-sm font-bold ${
                prop.ev > 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {prop.ev > 0 ? "+" : ""}
              {evPct}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Kelly</div>
            <div className="font-mono-nums text-sm font-bold text-white">{kellyPct}%</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Conf</div>
            <div
              className={`font-mono-nums text-sm font-bold ${
                prop.confidence >= 60
                  ? "text-green-400"
                  : prop.confidence >= 40
                  ? "text-yellow-400"
                  : "text-gray-400"
              }`}
            >
              {prop.confidence}
            </div>
          </div>
        </div>

        {/* Click hint */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
          <span className="flex items-center gap-1">
            {prop.edge > 0 ? (
              <TrendingUp className="h-3 w-3 text-green-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-400" />
            )}
            {(prop.trueProb * 100).toFixed(1)}% true vs {(prop.impliedProb * 100).toFixed(1)}%
            implied
          </span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
            Click for full breakdown &rarr;
          </span>
        </div>
      </div>
    </motion.div>
  );
}
