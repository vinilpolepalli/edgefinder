import { Prop, Sport } from "@/types";
import { evaluateProp } from "./edge-calculator";
import { buildPlayerStats } from "./espn-stats";
import type { ParsedProp } from "@/app/api/odds/route";

const SPORT_MAP: Record<string, Sport> = {
  basketball_nba: "nba",
  americanfootball_nfl: "nfl",
  baseball_mlb: "mlb",
  icehockey_nhl: "nhl",
};

function guessTeam(playerName: string, homeTeam: string, awayTeam: string): {
  team: string;
  opponent: string;
  isHome: boolean;
} {
  // Without a roster lookup we can't know for sure which team the player is on.
  // Return both teams and mark isHome as unknown (true by default).
  // The real adjustment will come from the opponent def rank lookup.
  return { team: homeTeam, opponent: awayTeam, isHome: true };
}

/**
 * Given raw prop odds from the Odds API, enrich with player stats
 * and run the statistical model to calculate edges.
 */
export async function enrichProps(rawProps: ParsedProp[]): Promise<Prop[]> {
  const enriched: Prop[] = [];

  for (const raw of rawProps) {
    const sport = SPORT_MAP[raw.sport] || "nba";
    const sportKey: "nba" | "nfl" = sport === "nfl" ? "nfl" : "nba";

    const stats = await buildPlayerStats(raw.playerName, sportKey, raw.statType);

    if (!stats || stats.gamesPlayed < 10) {
      continue; // Skip players with insufficient data
    }

    // Determine which side of the bet is in our odds range
    // For -300 to -500, the over or under is a heavy favorite
    const useOverSide = raw.overOdds <= -300 && raw.overOdds >= -500;
    const odds = useOverSide ? raw.overOdds : raw.underOdds;

    const result = evaluateProp(stats, raw.line, odds, {
      isHome: true,
      restDays: 1,
      teamPace: 1.0,
    });

    // Only include if there's a meaningful edge
    if (result.confidence < 20) continue;

    const { team, opponent, isHome } = guessTeam(raw.playerName, raw.homeTeam, raw.awayTeam);

    const prop: Prop = {
      id: `live-${raw.playerName.replace(/\s+/g, "-").toLowerCase()}-${raw.statType.toLowerCase()}-${raw.line}`,
      platform: "kalshi",
      playerName: raw.playerName,
      sport,
      statType: raw.statType,
      line: raw.line,
      marketOdds: odds,
      trueProb: result.trueProb,
      impliedProb: result.impliedProb,
      edge: result.edge,
      ev: result.ev,
      kelly: result.kelly,
      confidence: result.confidence,
      recommendation: result.recommendation,
      scrapedAt: new Date().toISOString(),
      gameTime: raw.gameTime,
      team,
      opponent,
      isHome,
      modelDetails: result.modelDetails,
      adjustments: result.adjustments,
      playerStats: stats,
    };

    enriched.push(prop);
  }

  // Sort by edge descending
  enriched.sort((a, b) => b.edge - a.edge);

  return enriched;
}

/**
 * Full pipeline: fetch odds -> enrich with stats -> return ready-to-display props.
 * Called from the /api/pipeline route.
 */
export async function runPipeline(
  baseUrl: string,
  sport: string = "basketball_nba",
  minOdds: number = -300,
  maxOdds: number = -500
): Promise<{
  props: Prop[];
  meta: {
    rawCount: number;
    enrichedCount: number;
    sport: string;
    oddsRange: { min: number; max: number };
    timestamp: string;
    usingDemo: boolean;
  };
}> {
  // Step 1: Fetch raw odds
  const oddsRes = await fetch(
    `${baseUrl}/api/odds?sport=${sport}&minOdds=${minOdds}&maxOdds=${maxOdds}`
  );
  const oddsData = await oddsRes.json();

  if (oddsData.usingDemo || !oddsData.props || oddsData.props.length === 0) {
    return {
      props: [],
      meta: {
        rawCount: 0,
        enrichedCount: 0,
        sport,
        oddsRange: { min: minOdds, max: maxOdds },
        timestamp: new Date().toISOString(),
        usingDemo: true,
      },
    };
  }

  // Step 2: Enrich with stats and run model
  const enriched = await enrichProps(oddsData.props);

  return {
    props: enriched,
    meta: {
      rawCount: oddsData.count,
      enrichedCount: enriched.length,
      sport,
      oddsRange: { min: minOdds, max: maxOdds },
      timestamp: new Date().toISOString(),
      usingDemo: false,
    },
  };
}
