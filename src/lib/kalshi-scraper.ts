import { Sport } from "@/types";

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

let lastKalshiRequest = 0;
async function rateLimitedKalshiFetch(url: string): Promise<Response | null> {
  const now = Date.now();
  const wait = Math.max(0, 150 - (now - lastKalshiRequest));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastKalshiRequest = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      return fetch(url, { cache: "no-store" });
    }
    return res;
  } catch {
    return null;
  }
}

export interface KalshiMarket {
  ticker: string;
  title: string;
  yes_sub_title: string;
  event_ticker: string;
  yes_bid_dollars: string;
  yes_ask_dollars: string;
  no_bid_dollars: string;
  no_ask_dollars: string;
  volume_fp: string;
  close_time: string;
  expected_expiration_time: string;
  status: string;
}

export interface KalshiProp {
  ticker: string;
  playerName: string;
  statType: string;
  line: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  impliedProb: number;
  americanOdds: number;
  volume: number;
  gameKey: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  sport: Sport;
}

const STAT_PREFIX_MAP: Record<string, string> = {
  PTS: "Points",
  REB: "Rebounds",
  AST: "Assists",
  "3PT": "Threes",
  STL: "Steals",
  BLK: "Blocks",
};

function parseTitle(title: string): { playerName: string; line: number } | null {
  const match = title.match(/^(.+?):\s*(\d+)\+/);
  if (!match) return null;
  return { playerName: match[1].trim(), line: parseInt(match[2]) };
}

export function priceToAmericanOdds(price: number): number {
  if (price <= 0 || price >= 1) return 0;
  if (price >= 0.5) return Math.round(-100 * price / (1 - price));
  return Math.round(100 * (1 - price) / price);
}

function getKalshiDateStr(): string {
  const now = new Date();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                   "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const year = now.getFullYear().toString().slice(-2);
  const month = months[now.getMonth()];
  const day = now.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

const ESPN_TO_KALSHI: Record<string, string> = {
  GS: "GSW", SA: "SAS", WSH: "WAS", UTAH: "UTA",
  NY: "NYK", NO: "NOP", PHX: "PHX", PHOE: "PHX",
};

function normalizeAbbr(espnAbbr: string): string {
  return ESPN_TO_KALSHI[espnAbbr] || espnAbbr;
}

async function discoverGamesFromSchedule(): Promise<string[]> {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const events = data?.events || [];
    const gameKeys: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const event of events) {
      const competitors = event?.competitions?.[0]?.competitors || [];
      if (competitors.length !== 2) continue;
      const away = competitors.find((c: { homeAway: string }) => c.homeAway === "away");
      const home = competitors.find((c: { homeAway: string }) => c.homeAway === "home");
      if (!away || !home) continue;
      gameKeys.push(`${normalizeAbbr(away.team?.abbreviation || "")}${normalizeAbbr(home.team?.abbreviation || "")}`);
    }
    return gameKeys;
  } catch (err) {
    console.error("Failed to fetch ESPN schedule:", err);
    return [];
  }
}

async function fetchMarketsForGame(
  statPrefix: string, gameKey: string, dateStr: string
): Promise<KalshiMarket[]> {
  const eventTicker = `KXNBA${statPrefix}-${dateStr}${gameKey}`;
  const url = `${KALSHI_API}/markets?limit=200&event_ticker=${eventTicker}`;
  const res = await rateLimitedKalshiFetch(url);
  if (!res || !res.ok) return [];
  try {
    const data = await res.json();
    return data.markets || [];
  } catch {
    return [];
  }
}

export type ScrapeProgressFn = (stage: string, percent: number, detail: string) => void;

/**
 * Scrape ALL live NBA player props from Kalshi — no odds filter.
 * Returns every prop line for every player across all games.
 * Accepts an optional onProgress callback for streaming progress.
 */
export async function scrapeAllKalshiProps(
  onProgress?: ScrapeProgressFn,
): Promise<{
  props: KalshiProp[];
  gamesFound: number;
  totalMarketsScanned: number;
  timestamp: string;
}> {
  const dateStr = getKalshiDateStr();

  onProgress?.("Discovering NBA games...", 2, "Checking ESPN schedule");
  const gameKeys = await discoverGamesFromSchedule();
  if (gameKeys.length === 0) return {
    props: [], gamesFound: 0, totalMarketsScanned: 0,
    timestamp: new Date().toISOString(),
  };

  onProgress?.("Fetching Kalshi markets...", 5, `Found ${gameKeys.length} games`);

  const statPrefixes = Object.keys(STAT_PREFIX_MAP);
  const totalCalls = gameKeys.length * statPrefixes.length;
  let completedCalls = 0;
  const allProps: KalshiProp[] = [];
  let totalScanned = 0;

  for (const gameKey of gameKeys) {
    const { away, home } = splitGameKey(gameKey);

    for (const prefix of statPrefixes) {
      const markets = await fetchMarketsForGame(prefix, gameKey, dateStr);
      totalScanned += markets.length;
      completedCalls++;

      if (completedCalls % 3 === 0 || completedCalls === totalCalls) {
        const pct = 5 + Math.round(25 * completedCalls / totalCalls);
        onProgress?.("Fetching Kalshi markets...", pct, `${completedCalls}/${totalCalls} queries (${allProps.length} props found)`);
      }

      for (const market of markets) {
        const yesBid = parseFloat(market.yes_bid_dollars) || 0;
        const yesAsk = parseFloat(market.yes_ask_dollars) || 0;
        const noBid = parseFloat(market.no_bid_dollars) || 0;
        const noAsk = parseFloat(market.no_ask_dollars) || 0;
        const midPrice = yesBid > 0 ? (yesBid + yesAsk) / 2 : yesAsk;
        const volume = parseFloat(market.volume_fp) || 0;

        if (midPrice <= 0 || midPrice >= 1) continue;

        const parsed = parseTitle(market.title);
        if (!parsed) continue;

        allProps.push({
          ticker: market.ticker,
          playerName: parsed.playerName,
          statType: STAT_PREFIX_MAP[prefix],
          line: parsed.line,
          yesBid, yesAsk, noBid, noAsk,
          impliedProb: midPrice,
          americanOdds: priceToAmericanOdds(midPrice),
          volume, gameKey,
          homeTeam: home, awayTeam: away,
          gameTime: market.expected_expiration_time || market.close_time,
          sport: "nba",
        });
      }
    }
  }

  allProps.sort((a, b) => b.volume - a.volume);

  return {
    props: allProps,
    gamesFound: gameKeys.length,
    totalMarketsScanned: totalScanned,
    timestamp: new Date().toISOString(),
  };
}

function splitGameKey(key: string): { away: string; home: string } {
  return { away: key.slice(0, 3), home: key.slice(3) };
}
