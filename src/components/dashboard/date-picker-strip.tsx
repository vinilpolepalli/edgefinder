"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { DailySummary } from "@/types";

interface Props {
  selectedDate: string;
  onDateChange: (date: string) => void;
  dailySummaries?: DailySummary[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return {
    dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
    dayNum: d.getDate(),
    monthShort: d.toLocaleDateString("en-US", { month: "short" }),
    isToday: dateStr === new Date().toISOString().split("T")[0],
  };
}

function getDatesAround(centerDate: string, range: number = 3): string[] {
  const dates: string[] = [];
  const center = new Date(centerDate + "T12:00:00");
  for (let i = -range; i <= range; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export function DatePickerStrip({ selectedDate, onDateChange, dailySummaries }: Props) {
  const dates = getDatesAround(selectedDate, 3);
  const summaryMap = new Map(dailySummaries?.map((s) => [s.date, s]));
  const selected = summaryMap.get(selectedDate);

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    onDateChange(d.toISOString().split("T")[0]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-orange-400" />
        <span className="text-sm font-medium text-gray-300">Browse by Date</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => shiftDate(-1)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex gap-1.5 flex-1 justify-center overflow-x-auto">
          {dates.map((date) => {
            const { dayName, dayNum, isToday } = formatDate(date);
            const isSelected = date === selectedDate;
            const summary = summaryMap.get(date);

            return (
              <button
                key={date}
                onClick={() => onDateChange(date)}
                className={cn(
                  "flex flex-col items-center px-3 py-2 rounded-lg transition-all min-w-[56px]",
                  isSelected
                    ? "bg-orange-500/20 border border-orange-500/30 text-orange-400"
                    : "hover:bg-white/5 text-gray-400 border border-transparent"
                )}
              >
                <span className="text-[10px] uppercase tracking-wider">
                  {isToday ? "Today" : dayName}
                </span>
                <span className={cn("font-mono-nums text-lg font-bold", isSelected && "text-orange-400")}>
                  {dayNum}
                </span>
                {summary && (
                  <span
                    className={cn(
                      "text-[9px] font-mono-nums",
                      summary.pnl >= 0 ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {summary.pnl >= 0 ? "+" : ""}${summary.pnl.toFixed(0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => shiftDate(1)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Daily summary bar for selected date */}
      {selected && (
        <div className="glass rounded-lg px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-gray-400">
            {formatDate(selectedDate).monthShort} {formatDate(selectedDate).dayNum}
          </span>
          <div className="flex items-center gap-4">
            <span>
              <span className="text-gray-500">Record:</span>{" "}
              <span className="font-mono-nums text-green-400">{selected.wins}W</span>
              <span className="text-gray-600">-</span>
              <span className="font-mono-nums text-red-400">{selected.losses}L</span>
            </span>
            <span>
              <span className="text-gray-500">P&L:</span>{" "}
              <span
                className={cn(
                  "font-mono-nums font-medium",
                  selected.pnl >= 0 ? "text-green-400" : "text-red-400"
                )}
              >
                {selected.pnl >= 0 ? "+" : ""}${selected.pnl.toFixed(0)}
              </span>
            </span>
            <span>
              <span className="text-gray-500">ROI:</span>{" "}
              <span className="font-mono-nums">{selected.roi.toFixed(1)}%</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
