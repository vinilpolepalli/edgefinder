import { NextResponse } from "next/server";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

interface OddsApiOutcome {
  name: string;
  description?: string;
  price: number;
  point?: number;
}

interface OddsApiMarket {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface ParsedProp {
  eventId: string;
  playerName: string;
  statType: string;
  line: number;
  overOdds: number;
  underOdds: number;
  bookmaker: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  sport: string;
}

const STAT_TYPE_MAP: Record<string, string> = {
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_threes: "Threes",
  player_blocks: "Blocks",
  player_steals: "Steals",
  player_points_rebounds_assists: "PRA",
  player_points_rebounds: "Pts+Reb",
  player_points_assists: "Pts+Ast",
  player_rebounds_assists: "Reb+Ast",
  player_turnovers: "Turnovers",
  player_double_double: "Double Double",
};

function parseOddsApiEvents(events: OddsApiEvent[], minOdds: number, maxOdds: number): ParsedProp[] {
  const props: ParsedProp[] = [];

  for (const event of events) {
    for (const book of event.bookmakers) {
      for (const market of book.markets) {
        const statType = STAT_TYPE_MAP[market.key];
        if (!statType) continue;

        const overOutcome = market.outcomes.find(o => o.name === "Over");
        const underOutcome = market.outcomes.find(o => o.name === "Under");

        if (!overOutcome || !underOutcome || overOutcome.point === undefined) continue;

        // Filter: only include if the over OR under odds are in the target range
        const overInRange = overOutcome.price >= maxOdds && overOutcome.price <= minOdds;
        const underInRange = underOutcome.price >= maxOdds && underOutcome.price <= minOdds;

        if (!overInRange && !underInRange) continue;

        props.push({
          eventId: event.id,
          playerName: overOutcome.description || "",
          statType,
          line: overOutcome.point,
          overOdds: overOutcome.price,
          underOdds: underOutcome.price,
          bookmaker: book.title,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          gameTime: event.commence_time,
          sport: event.sport_key,
        });
      }
    }
  }

  // Deduplicate: keep the best (most negative = highest implied prob) for each player+stat
  const best = new Map<string, ParsedProp>();
  for (const p of props) {
    const key = `${p.playerName}|${p.statType}|${p.line}`;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, p);
    } else {
      const existingBestOdds = Math.min(existing.overOdds, existing.underOdds);
      const newBestOdds = Math.min(p.overOdds, p.underOdds);
      if (newBestOdds < existingBestOdds) {
        best.set(key, p);
      }
    }
  }

  return Array.from(best.values());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport") || "basketball_nba";
  const minOdds = parseInt(searchParams.get("minOdds") || "-300");
  const maxOdds = parseInt(searchParams.get("maxOdds") || "-500");

  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      error: "ODDS_API_KEY not configured. Get a free key at https://the-odds-api.com",
      props: [],
      usingDemo: true,
    });
  }

  try {
    // Fetch player prop markets
    const propMarkets = [
      "player_points",
      "player_rebounds",
      "player_assists",
      "player_threes",
      "player_blocks",
      "player_steals",
    ];

    const allProps: ParsedProp[] = [];

    for (const market of propMarkets) {
      const url = `${ODDS_API_BASE}/sports/${sport}/events?apiKey=${apiKey}&regions=us&markets=${market}&oddsFormat=american`;

      const res = await fetch(url, {
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        console.error(`Odds API error for ${market}: ${res.status}`);
        continue;
      }

      const events: OddsApiEvent[] = await res.json();
      const parsed = parseOddsApiEvents(events, minOdds, maxOdds);
      allProps.push(...parsed);

      // Rate limit: 100ms between requests
      await new Promise(r => setTimeout(r, 100));
    }

    return NextResponse.json({
      props: allProps,
      count: allProps.length,
      sport,
      oddsRange: { min: minOdds, max: maxOdds },
      timestamp: new Date().toISOString(),
      usingDemo: false,
    });
  } catch (error) {
    console.error("Odds API fetch error:", error);
    return NextResponse.json({
      error: String(error),
      props: [],
      usingDemo: true,
    });
  }
}
