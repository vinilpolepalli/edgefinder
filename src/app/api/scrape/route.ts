import { NextResponse } from "next/server";
import { scrapeAllKalshiProps } from "@/lib/kalshi-scraper";
import { buildPlayerStatsBatch } from "@/lib/espn-stats";
import { evaluateProp } from "@/lib/edge-calculator";
import type { Prop, PlayerStats } from "@/types";

export const maxDuration = 60;

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

const TOP_PLAYERS = 30;

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
    .slice(0, TOP_PLAYERS)
    .map(([name]) => name);
  const topPlayerSet = new Set(topPlayers);
  const targetProps = rawProps.filter((p) => topPlayerSet.has(p.playerName));

  // Group stat types by player so we can batch-fetch (1 search + 1 gamelog per player)
  const playerStatTypes = new Map<string, Set<string>>();
  for (const p of targetProps) {
    if (!playerStatTypes.has(p.playerName)) playerStatTypes.set(p.playerName, new Set());
    playerStatTypes.get(p.playerName)!.add(p.statType);
  }

  const playerNames = [...playerStatTypes.keys()];
  const statsCache = new Map<string, PlayerStats | null>();

  send?.({ type: "progress", stage: "Fetching ESPN player stats...", percent: 35, detail: `0/${playerNames.length} players` });

  for (let i = 0; i < playerNames.length; i++) {
    const name = playerNames[i];
    const statTypes = [...playerStatTypes.get(name)!];

    const batchResult = await buildPlayerStatsBatch(name, "nba", statTypes);

    for (const [st, stats] of batchResult) {
      statsCache.set(`${name}|${st}`, stats);
    }

    if ((i + 1) % 2 === 0 || i === playerNames.length - 1) {
      const pct = 35 + Math.round(55 * (i + 1) / playerNames.length);
      send?.({ type: "progress", stage: "Fetching ESPN player stats...", percent: pct, detail: `${i + 1}/${playerNames.length} players` });
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
      playerStats: {
        ...stats,
        gameLog: stats.gameLog.slice(-10),
      },
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
