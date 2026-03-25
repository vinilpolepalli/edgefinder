"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export interface FilterState {
  platform: string;
  sport: string;
  statType: string;
  recommendation: string;
  minEdge: number;
  minConfidence: number;
  sortBy: string;
}

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function Filters({ filters, onChange }: Props) {
  const update = (key: keyof FilterState, value: string | number | null) => {
    if (value !== null) onChange({ ...filters, [key]: value });
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">Platform</Label>
          <Select value={filters.platform} onValueChange={(v) => update("platform", v)}>
            <SelectTrigger className="h-9 bg-white/[0.03] border-white/5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#111827] border-white/10">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="kalshi">Kalshi</SelectItem>
              <SelectItem value="fliff">Fliff</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-500 mb-1 block">Sport</Label>
          <Select value={filters.sport} onValueChange={(v) => update("sport", v)}>
            <SelectTrigger className="h-9 bg-white/[0.03] border-white/5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#111827] border-white/10">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="nba">NBA</SelectItem>
              <SelectItem value="nfl">NFL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-500 mb-1 block">Stat Type</Label>
          <Select value={filters.statType} onValueChange={(v) => update("statType", v)}>
            <SelectTrigger className="h-9 bg-white/[0.03] border-white/5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#111827] border-white/10">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Points">Points</SelectItem>
              <SelectItem value="Rebounds">Rebounds</SelectItem>
              <SelectItem value="Assists">Assists</SelectItem>
              <SelectItem value="Threes">Threes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-500 mb-1 block">Rating</Label>
          <Select
            value={filters.recommendation}
            onValueChange={(v) => update("recommendation", v)}
          >
            <SelectTrigger className="h-9 bg-white/[0.03] border-white/5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#111827] border-white/10">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="STRONG">Strong</SelectItem>
              <SelectItem value="LEAN">Lean</SelectItem>
              <SelectItem value="FADE">Fade</SelectItem>
              <SelectItem value="PASS">Pass</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-500 mb-1 block">
            Min Edge: {filters.minEdge}%
          </Label>
          <Slider
            value={[filters.minEdge]}
            onValueChange={(v) => update("minEdge", Array.isArray(v) ? v[0] : v)}
            min={0}
            max={15}
            step={0.5}
            className="mt-2"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-500 mb-1 block">
            Min Conf: {filters.minConfidence}
          </Label>
          <Slider
            value={[filters.minConfidence]}
            onValueChange={(v) => update("minConfidence", Array.isArray(v) ? v[0] : v)}
            min={0}
            max={80}
            step={5}
            className="mt-2"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-500 mb-1 block">Sort By</Label>
          <Select value={filters.sortBy} onValueChange={(v) => update("sortBy", v)}>
            <SelectTrigger className="h-9 bg-white/[0.03] border-white/5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#111827] border-white/10">
              <SelectItem value="edge">Edge</SelectItem>
              <SelectItem value="ev">EV</SelectItem>
              <SelectItem value="kelly">Kelly Size</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
