"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { DistributionPoint } from "@/types";

interface Props {
  data: DistributionPoint[];
  line: number;
  mean: number;
  height?: number;
}

export function DistributionChart({ data, line, mean, height = 200 }: Props) {
  const overData = data.map((d) => ({
    ...d,
    pdfOver: d.x >= line ? d.pdf : null,
    pdfUnder: d.x < line ? d.pdf : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={overData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id="gradOver" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradUnder" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradFull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="x"
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
          tickLine={false}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [Number(value)?.toFixed(4), "Density"]}
          labelFormatter={(label) => `Value: ${label}`}
        />
        <Area
          type="monotone"
          dataKey="pdf"
          stroke="#f97316"
          strokeWidth={2}
          fill="url(#gradFull)"
        />
        <Area
          type="monotone"
          dataKey="pdfOver"
          stroke="none"
          fill="url(#gradOver)"
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="pdfUnder"
          stroke="none"
          fill="url(#gradUnder)"
          connectNulls={false}
        />
        <ReferenceLine
          x={line}
          stroke="#f97316"
          strokeWidth={2}
          strokeDasharray="4 4"
          label={{
            value: `Line: ${line}`,
            position: "top",
            fill: "#f97316",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
        />
        <ReferenceLine
          x={Math.round(mean * 10) / 10}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1}
          strokeDasharray="2 2"
          label={{
            value: `μ: ${mean.toFixed(1)}`,
            position: "top",
            fill: "rgba(255,255,255,0.5)",
            fontSize: 10,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
