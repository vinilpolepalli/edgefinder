import { Prop, PlayerStats, Recommendation } from "@/types";
import { calculateTrueProb, AdjustmentInputs } from "./stats-engine";

/**
 * Convert American odds to implied probability.
 * Negative odds (favorites): |odds| / (|odds| + 100)
 * Positive odds (underdogs): 100 / (odds + 100)
 */
export function impliedProbFromOdds(americanOdds: number): number {
  if (americanOdds < 0) {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
  return 100 / (americanOdds + 100);
}

/**
 * Convert American odds to decimal odds.
 */
export function toDecimalOdds(americanOdds: number): number {
  if (americanOdds < 0) {
    return 1 + 100 / Math.abs(americanOdds);
  }
  return 1 + americanOdds / 100;
}

/**
 * Convert probability to American odds.
 */
export function probToAmericanOdds(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  if (prob >= 0.5) {
    return Math.round(-100 * prob / (1 - prob));
  }
  return Math.round(100 * (1 - prob) / prob);
}

/**
 * Expected Value: (trueProb x decimalOdds) - 1
 */
export function calculateEV(trueProb: number, americanOdds: number): number {
  const decimal = toDecimalOdds(americanOdds);
  return trueProb * decimal - 1;
}

/**
 * Quarter Kelly criterion for conservative bet sizing.
 * Kelly = (b*p - q) / b, then multiply by 0.25
 * Hard cap at 5% of bankroll.
 */
export function calculateKelly(
  trueProb: number,
  americanOdds: number,
  kellyMultiplier: number = 0.25,
  bankrollCapPct: number = 0.05
): number {
  const b = toDecimalOdds(americanOdds) - 1;
  if (b <= 0) return 0;

  const p = trueProb;
  const q = 1 - p;
  const kelly = (b * p - q) / b;

  if (kelly <= 0) return 0;

  const fractionalKelly = kelly * kellyMultiplier;
  return Math.min(fractionalKelly, bankrollCapPct);
}

/**
 * Confidence score: weighted(sampleSize 40%, CV 30%, edgeMagnitude 30%)
 * Penalize edges > 20% (likely model error).
 * Require GP >= 15 for any recommendation.
 */
export function calculateConfidence(
  stats: PlayerStats,
  edge: number
): number {
  if (stats.gamesPlayed < 15) return 0;

  // Sample size component (0-100): scales with games played
  const sampleScore = Math.min(100, (stats.gamesPlayed / 60) * 100);

  // CV (coefficient of variation) component: lower CV = higher confidence
  const cv = stats.stdDev / (stats.seasonAvg + 0.01);
  const cvScore = Math.max(0, 100 - cv * 200);

  // Edge magnitude: sweet spot is 3-10%, penalize > 20%
  let edgeScore: number;
  const absEdge = Math.abs(edge);
  if (absEdge > 0.20) {
    edgeScore = Math.max(0, 50 - (absEdge - 0.20) * 500);
  } else if (absEdge > 0.10) {
    edgeScore = 80 - (absEdge - 0.10) * 200;
  } else if (absEdge > 0.03) {
    edgeScore = 60 + (absEdge - 0.03) * 300;
  } else {
    edgeScore = absEdge * 2000;
  }
  edgeScore = Math.max(0, Math.min(100, edgeScore));

  const confidence = Math.round(sampleScore * 0.4 + cvScore * 0.3 + edgeScore * 0.3);
  return Math.max(0, Math.min(100, confidence));
}

/**
 * Determine recommendation based on edge and confidence.
 */
export function getRecommendation(edge: number, confidence: number): Recommendation {
  if (confidence < 40 || edge < 0.02) return "PASS";
  if (edge > 0.04 && confidence >= 50) return "STRONG";
  if (edge > 0.02 && confidence >= 40) return "LEAN";
  if (edge < -0.02) return "FADE";
  return "PASS";
}

/**
 * Generate plain-English reasoning for why an edge exists.
 */
export function generateReasoning(prop: Prop, stats: PlayerStats): string {
  const parts: string[] = [];

  // Recent form vs season
  const formDiff = stats.last5Avg - stats.seasonAvg;
  if (formDiff > 0.5) {
    parts.push(
      `${prop.playerName} is averaging ${stats.last5Avg.toFixed(1)} ${prop.statType} over the last 5 games, ` +
      `above the ${stats.seasonAvg.toFixed(1)} season average.`
    );
  } else if (formDiff < -0.5) {
    parts.push(
      `${prop.playerName} has cooled to ${stats.last5Avg.toFixed(1)} ${prop.statType} over the last 5 ` +
      `(season avg: ${stats.seasonAvg.toFixed(1)}).`
    );
  } else {
    parts.push(
      `${prop.playerName} is averaging ${stats.seasonAvg.toFixed(1)} ${prop.statType} this season ` +
      `(consistent at ${stats.last5Avg.toFixed(1)} over last 5).`
    );
  }

  // Line context
  const lineRelation = stats.seasonAvg > prop.line ? "above" : "below";
  parts.push(
    `The line of ${prop.line} is ${Math.abs(stats.seasonAvg - prop.line).toFixed(1)} ${lineRelation} the season average.`
  );

  // Opponent
  if (prop.adjustments?.factors) {
    const oppFactor = prop.adjustments.factors.find(f => f.name === "opponent");
    if (oppFactor) {
      parts.push(oppFactor.label + (oppFactor.impact > 0 ? " (favorable matchup)." : " (tough matchup)."));
    }
  }

  // Home/Away
  if (prop.isHome !== undefined) {
    const split = prop.isHome ? stats.homeAvg : stats.awayAvg;
    parts.push(
      `${prop.isHome ? "Home" : "Away"} game — averages ${split.toFixed(1)} ${prop.statType} in this split.`
    );
  }

  // Edge summary
  const edgePct = (prop.edge * 100).toFixed(1);
  const fairOdds = probToAmericanOdds(prop.trueProb);
  parts.push(
    `Model sees ${(prop.trueProb * 100).toFixed(1)}% chance of hitting over ${prop.line} ` +
    `vs the ${(prop.impliedProb * 100).toFixed(1)}% implied by ${prop.marketOdds > 0 ? "+" : ""}${prop.marketOdds} odds. ` +
    `That's a ${edgePct}% edge (fair odds: ${fairOdds > 0 ? "+" : ""}${fairOdds}).`
  );

  return parts.join(" ");
}

/**
 * MAIN ENTRY: Evaluate a single prop — calculate all edge metrics.
 */
export function evaluateProp(
  playerStats: PlayerStats,
  line: number,
  marketOdds: number,
  adjustmentInputs?: AdjustmentInputs,
  kellyMultiplier: number = 0.25
): {
  trueProb: number;
  impliedProb: number;
  edge: number;
  ev: number;
  kelly: number;
  confidence: number;
  recommendation: Recommendation;
  modelDetails: import("@/types").ModelDetails;
  adjustments: import("@/types").AdjustmentBreakdown;
} {
  const implied = impliedProbFromOdds(marketOdds);
  const { trueProb, modelDetails, adjustments } = calculateTrueProb(
    playerStats,
    line,
    adjustmentInputs
  );

  const edge = trueProb - implied;
  const ev = calculateEV(trueProb, marketOdds);
  const kelly = calculateKelly(trueProb, marketOdds, kellyMultiplier);
  const confidence = calculateConfidence(playerStats, edge);
  const recommendation = getRecommendation(edge, confidence);

  return {
    trueProb,
    impliedProb: Math.round(implied * 1000) / 1000,
    edge: Math.round(edge * 1000) / 1000,
    ev: Math.round(ev * 1000) / 1000,
    kelly: Math.round(kelly * 10000) / 10000,
    confidence,
    recommendation,
    modelDetails,
    adjustments,
  };
}
