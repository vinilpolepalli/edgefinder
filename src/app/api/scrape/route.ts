import { NextResponse } from "next/server";
import { scrapeAllKalshiProps } from "@/lib/kalshi-scraper";
import { buildPlayerStats } from "@/lib/espn-stats";
import { evaluateProp } from "@/lib/edge-calculator";
import type { Prop, PlayerStats } from "@/types";

export const maxDuration = 120;

// In-memory cache so refreshes are fast after first load
let cachedResult: { props: Prop[]; meta: Record<string, unknown>; cachedAt: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 min

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  // Return cache if fresh
  if (!forceRefresh && cachedResult && Date.now() - cachedResult.cachedAt < CACHE_TTL) {
    return NextResponse.json({ props: cachedResult.props, meta: { ...cachedResult.meta, cached: true } });
  }

  try {
    const { props: rawProps, gamesFound, totalMarketsScanned, timestamp } =
      await scrapeAllKalshiProps();

    if (rawProps.length === 0) {
      return NextResponse.json({
        props: [],
        meta: { gamesFound, totalMarketsScanned, timestamp, playersEnriched: 0 },
      });
    }

    // Find top 50 unique players by total volume across all their props
    const playerVolume = new Map<string, number>();
    for (const p of rawProps) {
      playerVolume.set(p.playerName, (playerVolume.get(p.playerName) || 0) + p.volume);
    }
    const topPlayers = [...playerVolume.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([name]) => name);
    const topPlayerSet = new Set(topPlayers);

    // Filter to only props for top 50 players
    const targetProps = rawProps.filter((p) => topPlayerSet.has(p.playerName));

    // Batch-fetch ESPN stats for each unique player+stat combo
    const statsCache = new Map<string, PlayerStats | null>();
    const uniqueKeys = new Set<string>();
    for (const p of targetProps) {
      uniqueKeys.add(`${p.playerName}|${p.statType}`);
    }

    console.log(`[Scrape] Enriching ${uniqueKeys.size} player+stat combos for ${topPlayers.length} players...`);

    for (const key of uniqueKeys) {
      const [name, statType] = key.split("|");
      const stats = await buildPlayerStats(name, "nba", statType);
      statsCache.set(key, stats);
    }

    // Build enriched props
    const enrichedProps: Prop[] = [];

    for (const raw of targetProps) {
      const key = `${raw.playerName}|${raw.statType}`;
      const stats = statsCache.get(key);
      if (!stats || stats.gamesPlayed < 5) continue;

      const result = evaluateProp(stats, raw.line, raw.americanOdds, {
        isHome: true,
        restDays: 1,
        teamPace: 1.0,
      });

      enrichedProps.push({
        id: `kalshi-${raw.ticker}`,
        platform: "kalshi",
        playerName: raw.playerName,
        sport: raw.sport,
        statType: raw.statType,
        line: raw.line,
        marketOdds: raw.americanOdds,
        trueProb: result.trueProb,
        impliedProb: result.impliedProb,
        edge: result.edge,
        ev: result.ev,
        kelly: result.kelly,
        confidence: result.confidence,
        recommendation: result.recommendation,
        scrapedAt: timestamp,
        gameTime: raw.gameTime,
        team: raw.homeTeam,
        opponent: raw.awayTeam,
        isHome: true,
        modelDetails: result.modelDetails,
        adjustments: result.adjustments,
        playerStats: stats,
      });
    }

    // Sort by edge descending
    enrichedProps.sort((a, b) => b.edge - a.edge);

    const meta = {
      gamesFound,
      totalMarketsScanned,
      totalRawProps: rawProps.length,
      playersEnriched: topPlayers.length,
      propsEnriched: enrichedProps.length,
      timestamp,
      cached: false,
    };

    cachedResult = { props: enrichedProps, meta, cachedAt: Date.now() };

    return NextResponse.json({ props: enrichedProps, meta });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: String(error), props: [], meta: { timestamp: new Date().toISOString() } },
      { status: 500 }
    );
  }
}
