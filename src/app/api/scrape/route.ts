import { NextResponse } from "next/server";
import { scrapeAllKalshiProps } from "@/lib/kalshi-scraper";
import { buildPlayerStats } from "@/lib/espn-stats";
import { evaluateProp } from "@/lib/edge-calculator";
import type { Prop, PlayerStats } from "@/types";

export const maxDuration = 120;

let cachedResult: { props: Prop[]; meta: Record<string, unknown>; cachedAt: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const wantStream = searchParams.get("stream") === "1";

  const cacheHit = !forceRefresh && cachedResult && Date.now() - cachedResult.cachedAt < CACHE_TTL;

  if (cacheHit && !wantStream) {
    return NextResponse.json({ props: cachedResult!.props, meta: { ...cachedResult!.meta, cached: true } });
  }

  if (cacheHit && wantStream) {
    return streamResponse((send) => {
      send({ type: "progress", stage: "Loading cached data", percent: 100, detail: "" });
      send({ type: "result", props: cachedResult!.props, meta: { ...cachedResult!.meta, cached: true } });
    });
  }

  if (wantStream) {
    return streamResponse(async (send) => {
      await runPipeline(send);
    });
  }

  try {
    const result = await runPipeline();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: String(error), props: [], meta: { timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

type SendFn = (data: Record<string, unknown>) => void;

function streamResponse(handler: (send: SendFn) => void | Promise<void>) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send: SendFn = (data) => {
    writer.write(encoder.encode(JSON.stringify(data) + "\n"));
  };

  (async () => {
    try {
      await handler(send);
    } catch (err) {
      send({ type: "error", error: String(err) });
    }
    writer.close();
  })();

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

async function runPipeline(
  send?: SendFn,
): Promise<{ props: Prop[]; meta: Record<string, unknown> }> {
  const { props: rawProps, gamesFound, totalMarketsScanned, timestamp } =
    await scrapeAllKalshiProps((stage, percent, detail) => {
      send?.({ type: "progress", stage, percent, detail });
    });

  if (rawProps.length === 0) {
    const out = { props: [] as Prop[], meta: { gamesFound, totalMarketsScanned, timestamp, playersEnriched: 0 } };
    send?.({ type: "progress", stage: "No games found", percent: 100, detail: "Check back when NBA games are on" });
    send?.({ type: "result", ...out });
    return out;
  }

  send?.({ type: "progress", stage: "Identifying top players...", percent: 32, detail: `${rawProps.length} raw props found` });

  const playerVolume = new Map<string, number>();
  for (const p of rawProps) {
    playerVolume.set(p.playerName, (playerVolume.get(p.playerName) || 0) + p.volume);
  }
  const topPlayers = [...playerVolume.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([name]) => name);
  const topPlayerSet = new Set(topPlayers);
  const targetProps = rawProps.filter((p) => topPlayerSet.has(p.playerName));

  const statsCache = new Map<string, PlayerStats | null>();
  const uniqueKeys = [...new Set(targetProps.map((p) => `${p.playerName}|${p.statType}`))];

  send?.({ type: "progress", stage: "Fetching ESPN player stats...", percent: 35, detail: `0/${uniqueKeys.length} player stats` });

  for (let i = 0; i < uniqueKeys.length; i++) {
    const [name, statType] = uniqueKeys[i].split("|");
    const stats = await buildPlayerStats(name, "nba", statType);
    statsCache.set(uniqueKeys[i], stats);

    if ((i + 1) % 3 === 0 || i === uniqueKeys.length - 1) {
      const pct = 35 + Math.round(55 * (i + 1) / uniqueKeys.length);
      send?.({ type: "progress", stage: "Fetching ESPN player stats...", percent: pct, detail: `${i + 1}/${uniqueKeys.length} player stats` });
    }
  }

  send?.({ type: "progress", stage: "Running edge models...", percent: 92, detail: "Calculating probabilities & edges" });

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

  send?.({ type: "progress", stage: "Complete!", percent: 100, detail: `${enrichedProps.length} props ready` });
  send?.({ type: "result", props: enrichedProps, meta });

  return { props: enrichedProps, meta };
}
