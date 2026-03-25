"use client";

import {
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Line,
  ComposedChart,
  Cell,
} from "recharts";
import { GameLogEntry } from "@/types";

interface Props {
  gameLog: GameLogEntry[];
  line: number;
  height?: number;
  showRollingAvg?: boolean;
}

function rollingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export function GameLogChart({ gameLog, line, height = 220, showRollingAvg = true }: Props) {
  const values = gameLog.map((g) => g.value);
  const rolling5 = rollingAverage(values, 5);
  const rolling10 = rollingAverage(values, 10);

  const data = gameLog.map((g, i) => ({
    date: g.date.slice(5),
    value: g.value,
    opponent: g.opponent,
    isOver: g.value >= line,
    rolling5: rolling5[i] ? Math.round(rolling5[i]! * 10) / 10 : undefined,
    rolling10: rolling10[i] ? Math.round(rolling10[i]! * 10) / 10 : undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
          tickLine={false}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          interval={Math.floor(data.length / 8)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              value: "Actual",
              rolling5: "5-Game Avg",
              rolling10: "10-Game Avg",
            };
            return [value, labels[String(name)] || String(name)];
          }}
          labelFormatter={(label) => `Game: ${label}`}
        />
        <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={16}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.isOver ? "rgba(34, 197, 94, 0.6)" : "rgba(239, 68, 68, 0.5)"}
            />
          ))}
        </Bar>
        {showRollingAvg && (
          <>
            <Line
              type="monotone"
              dataKey="rolling5"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="rolling10"
              stroke="#818cf8"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
              connectNulls
            />
          </>
        )}
        <ReferenceLine
          y={line}
          stroke="#f97316"
          strokeWidth={2}
          strokeDasharray="6 3"
          label={{
            value: `Line: ${line}`,
            position: "right",
            fill: "#f97316",
            fontSize: 11,
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
