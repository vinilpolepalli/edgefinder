import type { PlayerStats, GameLogEntry, Sport } from "@/types";

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response | null> {
  const now = Date.now();
  const wait = Math.max(0, 150 - (now - lastRequestTime));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestTime = Date.now();

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`ESPN API ${res.status} for ${url}`);
      return null;
    }
    return res;
  } catch (err) {
    console.error("ESPN fetch failed:", err);
    return null;
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;

const playerStatsCache = new Map<string, CacheEntry<PlayerStats>>();
const playerIdCache = new Map<string, CacheEntry<{ id: string; fullName: string } | null>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gameLogRawCache = new Map<string, CacheEntry<any>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

const STAT_TO_LABEL: Record<string, string> = {
  Points: "PTS",
  Rebounds: "REB",
  Assists: "AST",
  Blocks: "BLK",
  Steals: "STL",
  Threes: "3PT",
};

interface ESPNSearchResult {
  id: string;
  fullName: string;
}

async function searchPlayer(
  name: string,
  sport: "nba" | "nfl",
): Promise<ESPNSearchResult | null> {
  const cacheKey = `${name.toLowerCase()}|${sport}`;
  const cached = getCached(playerIdCache, cacheKey);
  if (cached !== undefined) return cached;

  const league = sport === "nba" ? "nba" : "nfl";
  const sportType = sport === "nba" ? "basketball" : "football";
  const url = `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(name)}&type=player&sport=${sportType}&league=${league}&limit=3`;

  const res = await rateLimitedFetch(url);
  if (!res) {
    setCache(playerIdCache, cacheKey, null);
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = json?.items ?? [];
    if (items.length === 0) {
      setCache(playerIdCache, cacheKey, null);
      return null;
    }

    const result = { id: String(items[0].id), fullName: items[0].displayName ?? name };
    setCache(playerIdCache, cacheKey, result);
    return result;
  } catch {
    setCache(playerIdCache, cacheKey, null);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRawGameLog(athleteId: string, sport: "nba" | "nfl"): Promise<any | null> {
  const cacheKey = `gl|${athleteId}|${sport}`;
  const cached = getCached(gameLogRawCache, cacheKey);
  if (cached !== undefined) return cached;

  const sportPath = sport === "nba" ? "basketball/nba" : "football/nfl";
  const url = `https://site.api.espn.com/apis/common/v3/sports/${sportPath}/athletes/${athleteId}/gamelog`;

  const res = await rateLimitedFetch(url);
  if (!res) {
    setCache(gameLogRawCache, cacheKey, null);
    return null;
  }

  try {
    const json = await res.json();
    setCache(gameLogRawCache, cacheKey, json);
    return json;
  } catch {
    setCache(gameLogRawCache, cacheKey, null);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGameLog(data: any, statType: string): GameLogEntry[] {
  const targetLabel = STAT_TO_LABEL[statType] ?? statType;

  const labels: string[] = data?.labels ?? [];
  const colIndex = labels.findIndex(
    (l: string) => l.toUpperCase() === targetLabel.toUpperCase()
  );
  if (colIndex === -1) return [];

  const minIndex = labels.findIndex(
    (l: string) => l.toUpperCase() === "MIN"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventMeta: Record<string, any> = data?.events ?? {};
  const entries: GameLogEntry[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seasonTypes: any[] = data?.seasonTypes ?? [];
  for (const st of seasonTypes) {
    if (st.displayName && !st.displayName.toLowerCase().includes("regular")) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const categories: any[] = st?.categories ?? [];
    for (const cat of categories) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = cat?.events ?? [];
      for (const ev of events) {
        const stats: string[] = ev?.stats ?? [];
        const eventId = String(ev?.eventId ?? ev?.id ?? "");

        const rawValue = stats[colIndex];
        if (rawValue === undefined) continue;

        let value: number;
        if (rawValue.includes("-")) {
          value = parseFloat(rawValue.split("-")[0]);
        } else {
          value = parseFloat(rawValue);
        }
        if (isNaN(value)) continue;

        const minutes = minIndex !== -1 && stats[minIndex]
          ? parseFloat(stats[minIndex])
          : undefined;

        const meta = eventMeta[eventId] ?? {};
        const dateStr: string = meta?.gameDate ?? "";
        const opponent: string = meta?.opponent?.abbreviation ?? "UNK";
        const isHome: boolean = meta?.atVs !== "@";

        entries.push({
          date: dateStr ? new Date(dateStr).toISOString().split("T")[0] : "",
          opponent,
          value,
          isHome,
          ...(minutes !== undefined && !isNaN(minutes) ? { minutes } : {}),
        });
      }
    }
  }

  return entries;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildStatsFromGameLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawGameLog: any,
  athlete: ESPNSearchResult,
  sport: "nba" | "nfl",
  statType: string,
): PlayerStats | null {
  const gameLog = parseGameLog(rawGameLog, statType);
  if (!gameLog || gameLog.length === 0) return null;

  const values = gameLog.map((g) => g.value);
  const homeValues = gameLog.filter((g) => g.isHome).map((g) => g.value);
  const awayValues = gameLog.filter((g) => !g.isHome).map((g) => g.value);

  const seasonAvg = mean(values);
  const last5 = values.slice(-5);
  const last10 = values.slice(-10);

  return {
    id: athlete.id,
    playerName: athlete.fullName,
    sport: sport as Sport,
    statType,
    seasonAvg: round2(seasonAvg),
    stdDev: round2(stdDev(values, seasonAvg)),
    last5Avg: round2(mean(last5)),
    last10Avg: round2(mean(last10)),
    gamesPlayed: gameLog.length,
    homeAvg: round2(mean(homeValues)),
    awayAvg: round2(mean(awayValues)),
    gameLog,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Fetch stats for ONE player across MULTIPLE stat types with only 2 API calls
 * (1 search + 1 gamelog), then derive stats for each stat type in-memory.
 */
export async function buildPlayerStatsBatch(
  name: string,
  sport: "nba" | "nfl",
  statTypes: string[],
): Promise<Map<string, PlayerStats | null>> {
  const results = new Map<string, PlayerStats | null>();

  // Check if all stat types are already cached
  let allCached = true;
  for (const st of statTypes) {
    const cacheKey = `${name.toLowerCase()}|${sport}|${st.toLowerCase()}`;
    const cached = getCached(playerStatsCache, cacheKey);
    if (cached !== undefined) {
      results.set(st, cached);
    } else {
      allCached = false;
    }
  }
  if (allCached && results.size === statTypes.length) return results;

  const athlete = await searchPlayer(name, sport);
  if (!athlete) {
    for (const st of statTypes) results.set(st, null);
    return results;
  }

  const rawGameLog = await fetchRawGameLog(athlete.id, sport);
  if (!rawGameLog) {
    for (const st of statTypes) results.set(st, null);
    return results;
  }

  for (const st of statTypes) {
    if (results.has(st)) continue;

    const stats = buildStatsFromGameLog(rawGameLog, athlete, sport, st);
    const cacheKey = `${name.toLowerCase()}|${sport}|${st.toLowerCase()}`;
    if (stats) setCache(playerStatsCache, cacheKey, stats);
    results.set(st, stats);
  }

  return results;
}

/**
 * Single stat type lookup (uses batch internally).
 */
export async function buildPlayerStats(
  name: string,
  sport: "nba" | "nfl",
  statType: string,
): Promise<PlayerStats | null> {
  const batch = await buildPlayerStatsBatch(name, sport, [statType]);
  return batch.get(statType) ?? null;
}
