import type { PlayerStats, GameLogEntry, Sport } from "@/types";

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response | null> {
  const now = Date.now();
  const wait = Math.max(0, 400 - (now - lastRequestTime));
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
const statsCache = new Map<string, CacheEntry<PlayerStats>>();

function getCached(key: string): PlayerStats | null {
  const entry = statsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    statsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: PlayerStats): void {
  statsCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
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

/**
 * Search ESPN for a player by name using the general search API.
 */
export async function searchPlayer(
  name: string,
  sport: "nba" | "nfl",
): Promise<ESPNSearchResult | null> {
  const league = sport === "nba" ? "nba" : "nfl";
  const sportType = sport === "nba" ? "basketball" : "football";
  const url = `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(name)}&type=player&sport=${sportType}&league=${league}&limit=3`;

  const res = await rateLimitedFetch(url);
  if (!res) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = json?.items ?? [];
    if (items.length === 0) return null;

    return {
      id: String(items[0].id),
      fullName: items[0].displayName ?? name,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a player's season game log and parse it into GameLogEntry[].
 *
 * ESPN gamelog structure:
 *   - data.labels: ["MIN", "FG", ..., "PTS"] (column headers)
 *   - data.seasonTypes[].categories[].events[]: { eventId, stats: ["39", "4-10", ...] }
 *   - data.events[eventId]: { gameDate, atVs, opponent: { abbreviation }, ... }
 */
export async function getPlayerGameLog(
  athleteId: string,
  sport: "nba" | "nfl",
  statType: string = "Points",
): Promise<GameLogEntry[] | null> {
  const sportPath = sport === "nba" ? "basketball/nba" : "football/nfl";
  const url = `https://site.api.espn.com/apis/common/v3/sports/${sportPath}/athletes/${athleteId}/gamelog`;

  const res = await rateLimitedFetch(url);
  if (!res) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    return parseGameLog(json, statType);
  } catch (err) {
    console.error("Failed to parse ESPN gamelog:", err);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGameLog(data: any, statType: string): GameLogEntry[] {
  const targetLabel = STAT_TO_LABEL[statType] ?? statType;

  // Column headers are at the TOP level of the response
  const labels: string[] = data?.labels ?? [];
  const colIndex = labels.findIndex(
    (l: string) => l.toUpperCase() === targetLabel.toUpperCase()
  );
  if (colIndex === -1) {
    console.error(`[ESPN] Column "${targetLabel}" not found in labels: ${labels.join(", ")}`);
    return [];
  }

  const minIndex = labels.findIndex(
    (l: string) => l.toUpperCase() === "MIN"
  );

  // Event metadata keyed by eventId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventMeta: Record<string, any> = data?.events ?? {};

  const entries: GameLogEntry[] = [];

  // Walk seasonTypes -> categories -> events to get stats arrays
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seasonTypes: any[] = data?.seasonTypes ?? [];
  for (const st of seasonTypes) {
    // Only use regular season
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

        // Handle compound stats like "3-5" for 3PT (take the made count)
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

        // Get game metadata
        const meta = eventMeta[eventId] ?? {};
        const dateStr: string = meta?.gameDate ?? "";
        const opponent: string = meta?.opponent?.abbreviation ?? "UNK";
        // atVs: "@" means away game, "vs" means home game
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

/**
 * End-to-end: search player -> fetch gamelog -> compute stats.
 * Results cached for 15 minutes.
 */
export async function buildPlayerStats(
  name: string,
  sport: "nba" | "nfl",
  statType: string,
): Promise<PlayerStats | null> {
  const cacheKey = `${name.toLowerCase()}|${sport}|${statType.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const athlete = await searchPlayer(name, sport);
  if (!athlete) {
    console.error(`[ESPN] Player not found: "${name}"`);
    return null;
  }

  const gameLog = await getPlayerGameLog(athlete.id, sport, statType);
  if (!gameLog || gameLog.length === 0) {
    console.error(`[ESPN] No gamelog for ${athlete.fullName} (${statType})`);
    return null;
  }

  const values = gameLog.map((g) => g.value);
  const homeValues = gameLog.filter((g) => g.isHome).map((g) => g.value);
  const awayValues = gameLog.filter((g) => !g.isHome).map((g) => g.value);

  const seasonAvg = mean(values);
  const last5 = values.slice(-5);
  const last10 = values.slice(-10);

  const stats: PlayerStats = {
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

  setCache(cacheKey, stats);
  return stats;
}
