"use client";

import { AdjustmentFactor } from "@/types";

interface Props {
  factors: AdjustmentFactor[];
}

export function FactorWaterfall({ factors }: Props) {
  if (!factors || factors.length === 0) return null;

  return (
    <div className="space-y-2">
      {factors.map((factor) => {
        const isBase = factor.name === "base";
        const pct = factor.value * 100;
        const impactPct = factor.impact;
        const barWidth = Math.min(95, Math.max(5, pct));

        return (
          <div key={factor.name} className="flex items-center gap-3">
            <div className="w-[140px] text-xs text-gray-400 text-right truncate">
              {factor.label}
            </div>
            <div className="flex-1 relative h-6">
              <div className="absolute inset-0 bg-white/[0.03] rounded" />
              <div
                className="absolute inset-y-0 left-0 rounded transition-all duration-500"
                style={{
                  width: `${barWidth}%`,
                  background: isBase
                    ? "rgba(249, 115, 22, 0.3)"
                    : impactPct >= 0
                    ? "rgba(34, 197, 94, 0.3)"
                    : "rgba(239, 68, 68, 0.3)",
                  borderRight: isBase
                    ? "2px solid #f97316"
                    : impactPct >= 0
                    ? "2px solid #22c55e"
                    : "2px solid #ef4444",
                }}
              />
              <div className="absolute inset-0 flex items-center px-2">
                <span className="font-mono-nums text-xs text-white/80">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="w-[60px] text-right">
              {!isBase && (
                <span
                  className={`font-mono-nums text-xs ${
                    impactPct >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {impactPct >= 0 ? "+" : ""}
                  {impactPct.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
