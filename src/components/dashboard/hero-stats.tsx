"use client";

import { motion } from "framer-motion";
import { Prop, UserSettings } from "@/types";
import { TrendingUp, Zap, DollarSign, Target } from "lucide-react";

interface Props {
  props: Prop[];
  settings: UserSettings;
}

export function HeroStats({ props, settings }: Props) {
  const strongBets = props.filter((p) => p.recommendation === "STRONG" || p.recommendation === "LEAN");
  const avgEdge =
    strongBets.length > 0
      ? strongBets.reduce((s, p) => s + p.edge, 0) / strongBets.length
      : 0;
  const projectedEV =
    strongBets.reduce((s, p) => s + p.ev * p.kelly * settings.bankroll, 0);

  const cards = [
    {
      label: "Strong Bets Today",
      value: strongBets.length.toString(),
      sub: `of ${props.length} total props`,
      icon: Zap,
      color: "text-orange-400",
      bg: "from-orange-500/10 to-orange-500/5",
    },
    {
      label: "Avg Edge",
      value: `${(avgEdge * 100).toFixed(1)}%`,
      sub: "across recommended bets",
      icon: TrendingUp,
      color: avgEdge > 0 ? "text-green-400" : "text-red-400",
      bg: avgEdge > 0 ? "from-green-500/10 to-green-500/5" : "from-red-500/10 to-red-500/5",
    },
    {
      label: "Projected Daily EV",
      value: `$${projectedEV.toFixed(0)}`,
      sub: `on $${settings.bankroll.toLocaleString()} bankroll`,
      icon: DollarSign,
      color: projectedEV > 0 ? "text-green-400" : "text-red-400",
      bg: "from-green-500/10 to-green-500/5",
    },
    {
      label: "Bankroll",
      value: `$${settings.bankroll.toLocaleString()}`,
      sub: `${(settings.kellyMultiplier * 100).toFixed(0)}% Kelly sizing`,
      icon: Target,
      color: "text-white",
      bg: "from-white/5 to-white/[0.02]",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className="glass rounded-xl p-4 relative overflow-hidden"
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${card.bg} pointer-events-none`}
          />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">
                {card.label}
              </span>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div className={`font-mono-nums text-2xl font-bold ${card.color}`}>
              {card.value}
            </div>
            <div className="text-xs text-gray-500 mt-1">{card.sub}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
