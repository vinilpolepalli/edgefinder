export type Sport = "nba" | "nfl" | "mlb" | "nhl";
export type Platform = "kalshi" | "fliff" | "manual";
export type Recommendation = "STRONG" | "LEAN" | "FADE" | "PASS";
export type BetOutcome = "win" | "loss" | "push" | "pending";

export interface PlayerStats {
  id: string;
  playerName: string;
  sport: Sport;
  statType: string;
  seasonAvg: number;
  stdDev: number;
  last5Avg: number;
  last10Avg: number;
  gamesPlayed: number;
  homeAvg: number;
  awayAvg: number;
  gameLog: GameLogEntry[];
  updatedAt: string;
}

export interface GameLogEntry {
  date: string;
  opponent: string;
  value: number;
  isHome: boolean;
  minutes?: number;
}

export interface Prop {
  id: string;
  platform: Platform;
  playerName: string;
  sport: Sport;
  statType: string;
  line: number;
  marketOdds: number;
  trueProb: number;
  impliedProb: number;
  edge: number;
  ev: number;
  kelly: number;
  confidence: number;
  recommendation: Recommendation;
  scrapedAt: string;
  gameTime: string;
  team?: string;
  opponent?: string;
  isHome?: boolean;
  modelDetails?: ModelDetails;
  adjustments?: AdjustmentBreakdown;
  playerStats?: PlayerStats;
}

export interface ModelDetails {
  normalProb: number;
  poissonProb: number;
  skewAdjustedProb: number;
  ensembleProb: number;
  normalWeight: number;
  poissonWeight: number;
  skewWeight: number;
  distributionData: DistributionPoint[];
}

export interface DistributionPoint {
  x: number;
  pdf: number;
  cdf: number;
}

export interface AdjustmentBreakdown {
  baseProb: number;
  opponentDefRank?: { label: string; factor: number };
  homeAway?: { label: string; factor: number };
  restDays?: { label: string; factor: number };
  pace?: { label: string; factor: number };
  minutesProjection?: { label: string; factor: number };
  injury?: { label: string; factor: number };
  finalProb: number;
  factors: AdjustmentFactor[];
}

export interface AdjustmentFactor {
  name: string;
  label: string;
  impact: number; // percentage change
  value: number; // resulting probability after this factor
}

export interface Bet {
  id: string;
  propId: string;
  prop?: Prop;
  betAmount: number;
  edgeAtBet: number;
  outcome: BetOutcome;
  pnl: number;
  createdAt: string;
}

export interface UserSettings {
  bankroll: number;
  kellyMultiplier: number;
  minConfidence: number;
  minEdge: number;
  notifications: boolean;
}

export interface DailySummary {
  date: string;
  totalBets: number;
  wins: number;
  losses: number;
  pushes: number;
  pnl: number;
  roi: number;
  avgEdge: number;
  avgConfidence: number;
}

export interface BacktestMetrics {
  totalBets: number;
  hitRate: number;
  totalPnl: number;
  roi: number;
  brierScore: number;
  maxDrawdown: number;
  sharpeRatio: number;
  byConfidenceTier: ConfidenceTierStats[];
  calibrationData: CalibrationPoint[];
  pnlCurve: PnlPoint[];
}

export interface ConfidenceTierStats {
  tier: string;
  range: [number, number];
  count: number;
  hitRate: number;
  avgEdge: number;
  roi: number;
}

export interface CalibrationPoint {
  predictedProb: number;
  actualRate: number;
  count: number;
}

export interface PnlPoint {
  date: string;
  cumulativePnl: number;
  dailyPnl: number;
  drawdown: number;
}
