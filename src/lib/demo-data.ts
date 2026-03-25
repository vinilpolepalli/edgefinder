import { PlayerStats, Prop, Bet, DailySummary, GameLogEntry, UserSettings } from "@/types";
import { evaluateProp } from "./edge-calculator";

function generateGameLog(
  mean: number,
  stdDev: number,
  count: number,
  opponents: string[]
): GameLogEntry[] {
  const log: GameLogEntry[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (count - i));
    const noise = (Math.random() - 0.5) * 2 * stdDev + (Math.random() - 0.5) * stdDev;
    const value = Math.max(0, Math.round((mean + noise) * 10) / 10);
    log.push({
      date: date.toISOString().split("T")[0],
      opponent: opponents[Math.floor(Math.random() * opponents.length)],
      value,
      isHome: Math.random() > 0.5,
      minutes: Math.round(30 + Math.random() * 10),
    });
  }
  return log;
}

const nbaOpponents = ["LAL", "BOS", "MIL", "PHI", "DEN", "PHX", "MIA", "GSW", "DAL", "MIN", "OKC", "NYK", "CLE", "SAC", "IND"];

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

interface PlayerDef {
  name: string;
  team: string;
  stat: string;
  mean: number;
  sd: number;
  line: number;
  odds: number; // -300 to -500 range: heavy favorites
  sport: "nba";
  opponent: string;
  isHome: boolean;
  defRank: number;
  restDays: number;
}

// ALL ODDS IN -300 TO -500 RANGE: These are heavy-favorite props where
// the player is very likely to hit the line, but we're looking for spots
// where the true probability is even higher than what the book implies.
const playerDefs: PlayerDef[] = [
  // Points unders/overs at heavy favorite lines
  { name: "Shai Gilgeous-Alexander", team: "OKC", stat: "Points", mean: 31.4, sd: 5.8, line: 22.5, odds: -380, sport: "nba", opponent: "UTA", isHome: true, defRank: 28, restDays: 2 },
  { name: "Luka Doncic", team: "DAL", stat: "Points", mean: 28.8, sd: 6.2, line: 20.5, odds: -420, sport: "nba", opponent: "POR", isHome: true, defRank: 26, restDays: 2 },
  { name: "Jayson Tatum", team: "BOS", stat: "Points", mean: 27.1, sd: 5.1, line: 20.5, odds: -340, sport: "nba", opponent: "WAS", isHome: true, defRank: 29, restDays: 1 },
  { name: "Giannis Antetokounmpo", team: "MIL", stat: "Points", mean: 30.5, sd: 5.5, line: 23.5, odds: -350, sport: "nba", opponent: "DET", isHome: true, defRank: 24, restDays: 2 },
  { name: "Anthony Edwards", team: "MIN", stat: "Points", mean: 25.9, sd: 5.8, line: 18.5, odds: -400, sport: "nba", opponent: "SAS", isHome: true, defRank: 27, restDays: 1 },
  { name: "Kevin Durant", team: "PHX", stat: "Points", mean: 27.2, sd: 4.5, line: 21.5, odds: -320, sport: "nba", opponent: "CHA", isHome: true, defRank: 25, restDays: 2 },

  // Rebounds at heavy favorite lines
  { name: "Nikola Jokic", team: "DEN", stat: "Rebounds", mean: 12.8, sd: 2.9, line: 8.5, odds: -450, sport: "nba", opponent: "POR", isHome: true, defRank: 22, restDays: 2 },
  { name: "Domantas Sabonis", team: "SAC", stat: "Rebounds", mean: 13.6, sd: 3.2, line: 9.5, odds: -380, sport: "nba", opponent: "UTA", isHome: true, defRank: 20, restDays: 1 },
  { name: "Giannis Antetokounmpo", team: "MIL", stat: "Rebounds", mean: 11.5, sd: 2.8, line: 7.5, odds: -420, sport: "nba", opponent: "DET", isHome: true, defRank: 23, restDays: 2 },

  // Assists at heavy favorite lines
  { name: "Tyrese Haliburton", team: "IND", stat: "Assists", mean: 10.8, sd: 3.0, line: 6.5, odds: -480, sport: "nba", opponent: "WAS", isHome: true, defRank: 28, restDays: 2 },
  { name: "Trae Young", team: "ATL", stat: "Assists", mean: 11.4, sd: 3.1, line: 7.5, odds: -380, sport: "nba", opponent: "CHA", isHome: true, defRank: 27, restDays: 3 },
  { name: "LaMelo Ball", team: "CHA", stat: "Assists", mean: 8.0, sd: 2.5, line: 5.5, odds: -350, sport: "nba", opponent: "DET", isHome: true, defRank: 26, restDays: 1 },

  // Threes at heavy favorite lines
  { name: "Stephen Curry", team: "GSW", stat: "Threes", mean: 4.8, sd: 2.1, line: 2.5, odds: -380, sport: "nba", opponent: "POR", isHome: true, defRank: 25, restDays: 2 },
  { name: "Klay Thompson", team: "DAL", stat: "Threes", mean: 3.2, sd: 1.7, line: 1.5, odds: -420, sport: "nba", opponent: "POR", isHome: true, defRank: 24, restDays: 2 },

  // More points with -300 to -500 odds
  { name: "Jalen Brunson", team: "NYK", stat: "Points", mean: 28.3, sd: 5.2, line: 20.5, odds: -360, sport: "nba", opponent: "BKN", isHome: true, defRank: 23, restDays: 1 },
  { name: "De'Aaron Fox", team: "SAC", stat: "Points", mean: 26.6, sd: 5.5, line: 19.5, odds: -340, sport: "nba", opponent: "UTA", isHome: true, defRank: 28, restDays: 2 },
  { name: "Donovan Mitchell", team: "CLE", stat: "Points", mean: 24.0, sd: 5.8, line: 17.5, odds: -370, sport: "nba", opponent: "TOR", isHome: true, defRank: 21, restDays: 1 },
];

function buildPlayerStats(def: PlayerDef): PlayerStats {
  const gl = generateGameLog(def.mean, def.sd, 40, nbaOpponents);
  const vals = gl.map(g => g.value);
  const last5 = vals.slice(-5);
  const last10 = vals.slice(-10);
  const homeVals = gl.filter(g => g.isHome).map(g => g.value);
  const awayVals = gl.filter(g => !g.isHome).map(g => g.value);

  return {
    id: `ps-${def.name.toLowerCase().replace(/\s+/g, "-")}-${def.stat.toLowerCase()}`,
    playerName: def.name,
    sport: def.sport,
    statType: def.stat,
    seasonAvg: Math.round(avg(vals) * 10) / 10,
    stdDev: Math.round(stddev(vals) * 10) / 10,
    last5Avg: Math.round(avg(last5) * 10) / 10,
    last10Avg: Math.round(avg(last10) * 10) / 10,
    gamesPlayed: gl.length,
    homeAvg: Math.round(avg(homeVals) * 10) / 10,
    awayAvg: Math.round(avg(awayVals) * 10) / 10,
    gameLog: gl,
    updatedAt: new Date().toISOString(),
  };
}

function buildProp(def: PlayerDef, stats: PlayerStats): Prop {
  const result = evaluateProp(stats, def.line, def.odds, {
    opponentDefRank: def.defRank,
    isHome: def.isHome,
    restDays: def.restDays,
    teamPace: 0.97 + Math.random() * 0.06,
  });

  const gameTime = new Date();
  gameTime.setHours(19 + Math.floor(Math.random() * 3), Math.random() > 0.5 ? 0 : 30);

  const prop: Prop = {
    id: `prop-${def.name.toLowerCase().replace(/\s+/g, "-")}-${def.stat.toLowerCase()}`,
    platform: Math.random() > 0.3 ? "kalshi" : "fliff",
    playerName: def.name,
    sport: def.sport,
    statType: def.stat,
    line: def.line,
    marketOdds: def.odds,
    trueProb: result.trueProb,
    impliedProb: result.impliedProb,
    edge: result.edge,
    ev: result.ev,
    kelly: result.kelly,
    confidence: result.confidence,
    recommendation: result.recommendation,
    scrapedAt: new Date().toISOString(),
    gameTime: gameTime.toISOString(),
    team: def.team,
    opponent: def.opponent,
    isHome: def.isHome,
    modelDetails: result.modelDetails,
    adjustments: result.adjustments,
    playerStats: stats,
  };

  return prop;
}

let _cachedProps: Prop[] | null = null;
let _cachedStats: Map<string, PlayerStats> | null = null;

export function getDemoProps(): Prop[] {
  if (_cachedProps) return _cachedProps;

  const statsMap = new Map<string, PlayerStats>();
  const props: Prop[] = [];

  for (const def of playerDefs) {
    const stats = buildPlayerStats(def);
    statsMap.set(stats.id, stats);
    const prop = buildProp(def, stats);
    props.push(prop);
  }

  props.sort((a, b) => b.edge - a.edge);
  _cachedStats = statsMap;
  _cachedProps = props;
  return props;
}

export function getDemoPlayerStats(): Map<string, PlayerStats> {
  if (!_cachedStats) getDemoProps();
  return _cachedStats!;
}

export function getDemoBetHistory(): Bet[] {
  const bets: Bet[] = [];
  const props = getDemoProps();

  for (let day = 30; day >= 1; day--) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    const dayProps = props.slice(0, 3 + Math.floor(Math.random() * 5));

    for (const prop of dayProps) {
      const hit = Math.random() < prop.trueProb;
      const betAmt = 100 * prop.kelly * 10;
      const decimal = prop.marketOdds < 0
        ? 1 + 100 / Math.abs(prop.marketOdds)
        : 1 + prop.marketOdds / 100;
      const pnl = hit ? betAmt * (decimal - 1) : -betAmt;

      bets.push({
        id: `bet-${day}-${prop.id}`,
        propId: prop.id,
        prop: { ...prop, scrapedAt: date.toISOString() },
        betAmount: Math.round(betAmt * 100) / 100,
        edgeAtBet: prop.edge,
        outcome: hit ? "win" : "loss",
        pnl: Math.round(pnl * 100) / 100,
        createdAt: date.toISOString(),
      });
    }
  }

  return bets;
}

export function getDemoDailySummaries(): DailySummary[] {
  const bets = getDemoBetHistory();
  const byDate = new Map<string, Bet[]>();

  for (const bet of bets) {
    const d = bet.createdAt.split("T")[0];
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(bet);
  }

  const summaries: DailySummary[] = [];
  for (const [date, dayBets] of byDate) {
    const wins = dayBets.filter(b => b.outcome === "win").length;
    const losses = dayBets.filter(b => b.outcome === "loss").length;
    const pnl = dayBets.reduce((s, b) => s + b.pnl, 0);
    const totalWagered = dayBets.reduce((s, b) => s + b.betAmount, 0);

    summaries.push({
      date,
      totalBets: dayBets.length,
      wins,
      losses,
      pushes: 0,
      pnl: Math.round(pnl * 100) / 100,
      roi: totalWagered > 0 ? Math.round((pnl / totalWagered) * 10000) / 100 : 0,
      avgEdge: Math.round(avg(dayBets.map(b => b.edgeAtBet)) * 1000) / 10,
      avgConfidence: Math.round(avg(dayBets.map(b => b.prop?.confidence || 0))),
    });
  }

  return summaries.sort((a, b) => a.date.localeCompare(b.date));
}

export const defaultSettings: UserSettings = {
  bankroll: 1000,
  kellyMultiplier: 0.25,
  minConfidence: 40,
  minEdge: 2,
  notifications: false,
};
