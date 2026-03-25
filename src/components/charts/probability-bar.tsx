"use client";

interface Props {
  modelProb: number;
  impliedProb: number;
  height?: number;
}

export function ProbabilityBar({ modelProb, impliedProb }: Props) {
  const modelPct = modelProb * 100;
  const impliedPct = impliedProb * 100;
  const edge = modelPct - impliedPct;
  const isPositive = edge > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Model Probability</span>
          <span className="font-mono-nums text-green-400 font-medium">
            {modelPct.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500/60 to-green-400/80 transition-all duration-700"
            style={{ width: `${modelPct}%` }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Implied by Odds</span>
          <span className="font-mono-nums text-gray-300">
            {impliedPct.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gray-500/40 to-gray-400/60 transition-all duration-700"
            style={{ width: `${impliedPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <span className="text-xs text-gray-400">Edge</span>
        <span
          className={`font-mono-nums text-sm font-bold ${
            isPositive ? "text-green-400" : "text-red-400"
          }`}
        >
          {isPositive ? "+" : ""}
          {edge.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
