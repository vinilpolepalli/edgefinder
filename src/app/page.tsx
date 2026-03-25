"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeroStats } from "@/components/dashboard/hero-stats";
import { EdgeExplainerPanel } from "@/components/edge-explainer/edge-explainer-panel";
import { defaultSettings } from "@/lib/demo-data";
import { Prop } from "@/types";
import { probToAmericanOdds } from "@/lib/edge-calculator";
import {
  Loader2, RefreshCw, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, Search, Filter, Clock
} from "lucide-react";

type SortField = "edge" | "ev" | "confidence" | "playerName" | "impliedProb";
type GroupBy = "player" | "stat" | "game" | "none";

export default function Dashboard() {
  const [selectedProp, setSelectedProp] = useState<Prop | null>(null);
  const [allProps, setAllProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("edge");
  const [sortAsc, setSortAsc] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("player");
  const [statFilter, setStatFilter] = useState("all");
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const [showOnlyEdges, setShowOnlyEdges] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scrape${force ? "?refresh=1" : ""}`);
      const data = await res.json();
      if (data.props?.length > 0) {
        setAllProps(data.props);
        setMeta(data.meta);
        setLastFetch(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    refreshTimer.current = setInterval(() => fetchData(), 2 * 60 * 1000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [fetchData]);

  const filteredProps = useMemo(() => {
    let result = [...allProps];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.playerName.toLowerCase().includes(q) || p.statType.toLowerCase().includes(q)
      );
    }
    if (statFilter !== "all") {
      result = result.filter((p) => p.statType === statFilter);
    }
    if (showOnlyEdges) {
      result = result.filter((p) => p.edge > 0.02 && p.confidence >= 40);
    }

    const dir = sortAsc ? 1 : -1;
    result.sort((a, b) => {
      if (sortField === "playerName") return dir * a.playerName.localeCompare(b.playerName);
      const av = a[sortField] as number;
      const bv = b[sortField] as number;
      return dir * (av - bv);
    });
    return result;
  }, [allProps, search, statFilter, showOnlyEdges, sortField, sortAsc]);

  const statTypes = useMemo(() => {
    const types = new Set(allProps.map((p) => p.statType));
    return ["all", ...Array.from(types).sort()];
  }, [allProps]);

  // Group props by player
  const groupedByPlayer = useMemo(() => {
    const map = new Map<string, Prop[]>();
    for (const p of filteredProps) {
      const key = p.playerName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Sort players by their best edge
    return [...map.entries()].sort((a, b) => {
      const bestA = Math.max(...a[1].map((p) => p.edge));
      const bestB = Math.max(...b[1].map((p) => p.edge));
      return bestB - bestA;
    });
  }, [filteredProps]);

  const togglePlayer = (name: string) => {
    setExpandedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const uniquePlayers = new Set(allProps.map((p) => p.playerName)).size;

  return (
    <div className="space-y-4 pt-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">
            Live Kalshi Props
            {meta && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                {String(meta.gamesFound)} games &middot; {uniquePlayers} players &middot; {allProps.length} props
              </span>
            )}
          </h1>
          {lastFetch && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" />
              Updated {lastFetch} &middot; auto-refreshes every 2 min
              {meta?.cached === true && <span className="text-yellow-600">(cached)</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg px-3 py-2 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {loading ? "Fetching live data..." : "Force Refresh"}
        </button>
      </div>

      {/* Hero stats */}
      {allProps.length > 0 && <HeroStats props={allProps} settings={defaultSettings} />}

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search player or stat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>
        <select
          value={statFilter}
          onChange={(e) => setStatFilter(e.target.value)}
          className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none"
        >
          {statTypes.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Stats" : s}</option>
          ))}
        </select>
        <button
          onClick={() => setShowOnlyEdges(!showOnlyEdges)}
          className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${
            showOnlyEdges
              ? "bg-green-500/20 border-green-500/30 text-green-400"
              : "bg-white/[0.03] border-white/10 text-gray-400"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Edges Only
        </button>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none"
        >
          <option value="player">Group by Player</option>
          <option value="none">Flat List</option>
        </select>
      </div>

      {/* Loading state */}
      {loading && allProps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          <p className="text-gray-400 text-sm">Scraping Kalshi markets &amp; running models...</p>
          <p className="text-gray-600 text-xs">First load takes ~60s (fetching ESPN stats for 50 players)</p>
        </div>
      )}

      {/* Main content */}
      {groupBy === "player" ? (
        <div className="space-y-2">
          {groupedByPlayer.map(([playerName, props]) => {
            const isExpanded = expandedPlayers.has(playerName);
            const bestEdge = Math.max(...props.map((p) => p.edge));
            const bestProp = props.find((p) => p.edge === bestEdge)!;
            const hasEdge = bestEdge > 0.02 && bestProp.confidence >= 40;

            return (
              <motion.div
                key={playerName}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border rounded-xl overflow-hidden transition-colors ${
                  hasEdge ? "border-green-500/20 bg-green-500/[0.02]" : "border-white/5 bg-white/[0.02]"
                }`}
              >
                {/* Player header row */}
                <button
                  onClick={() => togglePlayer(playerName)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <span className="font-semibold text-sm">{playerName}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {bestProp.team} vs {bestProp.opponent}
                      </span>
                    </div>
                    {hasEdge && (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium">
                        EDGE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">{props.length} props</span>
                    {bestEdge > 0 && (
                      <span className="font-mono text-xs text-green-400">
                        best: +{(bestEdge * 100).toFixed(1)}%
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                  </div>
                </button>

                {/* Expanded props table */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="border-t border-white/5">
                        {/* Table header */}
                        <div className="grid grid-cols-[1fr_80px_80px_90px_90px_80px_80px_60px_80px] gap-2 px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/5">
                          <SortHeader label="Stat & Line" field="playerName" current={sortField} asc={sortAsc} onSort={toggleSort} />
                          <span className="text-right">Kalshi</span>
                          <span className="text-right">Our Odds</span>
                          <span className="text-right">Implied %</span>
                          <SortHeader label="Model %" field="impliedProb" current={sortField} asc={sortAsc} onSort={toggleSort} className="text-right" />
                          <SortHeader label="Edge" field="edge" current={sortField} asc={sortAsc} onSort={toggleSort} className="text-right" />
                          <SortHeader label="EV" field="ev" current={sortField} asc={sortAsc} onSort={toggleSort} className="text-right" />
                          <SortHeader label="Conf" field="confidence" current={sortField} asc={sortAsc} onSort={toggleSort} className="text-right" />
                          <span className="text-right">Signal</span>
                        </div>
                        {/* Prop rows */}
                        {props.map((prop) => (
                          <PropRow key={prop.id} prop={prop} onClick={() => setSelectedProp(prop)} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Flat list mode */
        <div className="border border-white/5 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.5fr_1fr_80px_80px_90px_90px_80px_80px_60px_80px] gap-2 px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/5 bg-white/[0.02]">
            <SortHeader label="Player" field="playerName" current={sortField} asc={sortAsc} onSort={toggleSort} />
            <span>Stat &amp; Line</span>
            <span className="text-right">Kalshi</span>
            <span className="text-right">Our Odds</span>
            <span className="text-right">Implied %</span>
            <span className="text-right">Model %</span>
            <SortHeader label="Edge" field="edge" current={sortField} asc={sortAsc} onSort={toggleSort} className="text-right" />
            <SortHeader label="EV" field="ev" current={sortField} asc={sortAsc} onSort={toggleSort} className="text-right" />
            <SortHeader label="Conf" field="confidence" current={sortField} asc={sortAsc} onSort={toggleSort} className="text-right" />
            <span className="text-right">Signal</span>
          </div>
          {filteredProps.map((prop) => {
            const ourOdds = probToAmericanOdds(prop.trueProb);
            return (
              <div
                key={prop.id}
                onClick={() => setSelectedProp(prop)}
                className="grid grid-cols-[1.5fr_1fr_80px_80px_90px_90px_80px_80px_60px_80px] gap-2 px-4 py-2.5 border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors text-sm"
              >
                <div>
                  <span className="font-medium">{prop.playerName}</span>
                  <span className="text-xs text-gray-500 ml-1.5">{prop.team}</span>
                </div>
                <span className="font-mono text-xs">
                  {prop.statType} O{prop.line}
                </span>
                <span className="text-right font-mono text-xs text-gray-400">
                  {prop.marketOdds > 0 ? "+" : ""}{prop.marketOdds}
                </span>
                <OurOddsCell marketOdds={prop.marketOdds} ourOdds={ourOdds} />
                <span className="text-right font-mono text-xs">
                  {(prop.impliedProb * 100).toFixed(1)}%
                </span>
                <span className={`text-right font-mono text-xs ${prop.trueProb > prop.impliedProb ? "text-green-400" : "text-red-400"}`}>
                  {(prop.trueProb * 100).toFixed(1)}%
                </span>
                <EdgeCell edge={prop.edge} />
                <span className={`text-right font-mono text-xs ${prop.ev > 0 ? "text-green-400" : "text-red-400"}`}>
                  {(prop.ev * 100).toFixed(1)}%
                </span>
                <span className="text-right font-mono text-xs">{prop.confidence}</span>
                <SignalBadge rec={prop.recommendation} />
              </div>
            );
          })}
        </div>
      )}

      {!loading && allProps.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">No games on right now</p>
          <p className="text-sm mt-1">Check back when NBA games are scheduled today</p>
        </div>
      )}

      {/* Edge Explainer Panel */}
      <EdgeExplainerPanel prop={selectedProp} onClose={() => setSelectedProp(null)} />
    </div>
  );
}

function PropRow({ prop, onClick }: { prop: Prop; onClick: () => void }) {
  const ourOdds = probToAmericanOdds(prop.trueProb);
  return (
    <div
      onClick={onClick}
      className="grid grid-cols-[1fr_80px_80px_90px_90px_80px_80px_60px_80px] gap-2 px-4 py-2 hover:bg-white/[0.04] cursor-pointer transition-colors text-sm border-b border-white/[0.03] last:border-0"
    >
      <span className="font-mono text-xs">
        {prop.statType} <span className="text-orange-400">O{prop.line}</span>
      </span>
      <span className="text-right font-mono text-xs text-gray-400">
        {prop.marketOdds > 0 ? "+" : ""}{prop.marketOdds}
      </span>
      <OurOddsCell marketOdds={prop.marketOdds} ourOdds={ourOdds} />
      <span className="text-right font-mono text-xs">
        {(prop.impliedProb * 100).toFixed(1)}%
      </span>
      <span className={`text-right font-mono text-xs font-medium ${prop.trueProb > prop.impliedProb ? "text-green-400" : "text-red-400"}`}>
        {(prop.trueProb * 100).toFixed(1)}%
      </span>
      <EdgeCell edge={prop.edge} />
      <span className={`text-right font-mono text-xs ${prop.ev > 0 ? "text-green-400" : "text-red-400"}`}>
        {prop.ev > 0 ? "+" : ""}{(prop.ev * 100).toFixed(1)}%
      </span>
      <span className="text-right font-mono text-xs">{prop.confidence}</span>
      <SignalBadge rec={prop.recommendation} />
    </div>
  );
}

function OurOddsCell({ marketOdds, ourOdds }: { marketOdds: number; ourOdds: number }) {
  const betterValue = (ourOdds < 0 && marketOdds < 0 && Math.abs(ourOdds) > Math.abs(marketOdds))
    || (ourOdds > 0 && marketOdds > 0 && ourOdds < marketOdds)
    || (ourOdds < 0 && marketOdds > 0);
  return (
    <span className={`text-right font-mono text-xs font-medium ${betterValue ? "text-green-400" : "text-orange-300"}`}>
      {ourOdds > 0 ? "+" : ""}{ourOdds}
    </span>
  );
}

function EdgeCell({ edge }: { edge: number }) {
  const pct = edge * 100;
  const color = pct > 4 ? "text-green-400" : pct > 0 ? "text-green-400/70" : pct < -2 ? "text-red-400" : "text-gray-500";
  const Icon = pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`text-right font-mono text-xs flex items-center justify-end gap-1 ${color}`}>
      <Icon className="h-3 w-3" />
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function SignalBadge({ rec }: { rec: string }) {
  const styles: Record<string, string> = {
    STRONG: "bg-green-500/20 text-green-400 border-green-500/30",
    LEAN: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    FADE: "bg-red-500/15 text-red-400 border-red-500/20",
    PASS: "bg-white/5 text-gray-500 border-white/10",
  };
  return (
    <span className={`text-right text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block ${styles[rec] || styles.PASS}`}>
      {rec}
    </span>
  );
}

function SortHeader({
  label, field, current, asc, onSort, className = "",
}: {
  label: string; field: SortField; current: SortField; asc: boolean;
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = current === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-0.5 hover:text-white transition-colors ${active ? "text-orange-400" : ""} ${className}`}
    >
      {label}
      {active && (asc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  );
}
