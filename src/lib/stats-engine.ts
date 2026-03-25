import { PlayerStats, ModelDetails, DistributionPoint, AdjustmentBreakdown, AdjustmentFactor } from "@/types";

// ============================================================
// A. NORMAL CDF — Abramowitz & Stegun approximation (error < 1.5e-7)
// ============================================================
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

export function normalPDF(x: number, mean: number, stdDev: number): number {
  const z = (x - mean) / stdDev;
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

/**
 * P(X >= line) using normal distribution with continuity correction.
 * For discrete data like points/yards, we use line - 0.5 as the cutoff.
 */
export function normalOverProb(mean: number, stdDev: number, line: number): number {
  if (stdDev <= 0) return mean >= line ? 0.99 : 0.01;
  const z = (line - 0.5 - mean) / stdDev;
  return 1 - normalCDF(z);
}

// ============================================================
// B. POISSON MODEL — for low-count stats (rebounds, assists, blocks, steals, TDs)
// ============================================================
function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

/**
 * P(X >= line) using Poisson distribution.
 * Sum P(X=k) for k=0 to line-1, then subtract from 1.
 */
export function poissonOverProb(lambda: number, line: number): number {
  if (lambda <= 0) return 0.01;
  const intLine = Math.ceil(line);
  let cumulativeUnder = 0;
  for (let k = 0; k < intLine; k++) {
    cumulativeUnder += poissonPMF(k, lambda);
  }
  return Math.max(0.001, Math.min(0.999, 1 - cumulativeUnder));
}

// ============================================================
// C. SKEW-ADJUSTED MODEL — method of moments from game log
// ============================================================
function calcSkewness(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const m2 = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const m3 = values.reduce((sum, v) => sum + Math.pow(v - mean, 3), 0) / n;
  const stdDev = Math.sqrt(m2);
  if (stdDev === 0) return 0;
  return m3 / Math.pow(stdDev, 3);
}

/**
 * Skew-normal approximation: adjusts normal CDF by incorporating skewness.
 * Uses Cornish-Fisher expansion for better tail behavior.
 */
export function skewAdjustedOverProb(
  mean: number,
  stdDev: number,
  line: number,
  gameLog: number[]
): number {
  if (stdDev <= 0 || gameLog.length < 5) {
    return normalOverProb(mean, stdDev, line);
  }

  const skew = calcSkewness(gameLog);
  const z = (line - 0.5 - mean) / stdDev;

  // Cornish-Fisher expansion to adjust z-score for skewness
  const adjustedZ = z - (skew / 6) * (z * z - 1);

  return Math.max(0.001, Math.min(0.999, 1 - normalCDF(adjustedZ)));
}

// ============================================================
// D. BAYESIAN UPDATING — blend season-long with recent performance
// ============================================================
export function bayesianUpdate(
  seasonAvg: number,
  recentAvg: number,
  gamesPlayed: number,
): number {
  // Weight for recent data increases with more games played, capped at 0.15
  const recentWeight = Math.min(0.15, 0.05 + gamesPlayed * 0.002);

  // Regression to mean: shrink more when fewer games played
  const regressionWeight = gamesPlayed / (gamesPlayed + 10);

  const regressed = seasonAvg * (1 - regressionWeight) + seasonAvg * regressionWeight;
  const blended = regressed * (1 - recentWeight) + recentAvg * recentWeight;

  return blended;
}

/**
 * Full Bayesian posterior mean: prior = season avg, likelihood = recent games.
 * Uses precision-weighted blending.
 */
export function bayesianPosterior(stats: PlayerStats): number {
  const priorMean = stats.seasonAvg;
  const likelihoodMean = stats.last5Avg;

  const weight = Math.min(0.15, 0.05 + stats.gamesPlayed * 0.002);
  const posteriorMean = priorMean * (1 - weight) + likelihoodMean * weight;

  return posteriorMean;
}

// ============================================================
// E. ADJUSTMENTS STACK — applied multiplicatively
// ============================================================
export interface AdjustmentInputs {
  opponentDefRank?: number; // 1-30, lower = better defense
  isHome?: boolean;
  restDays?: number;
  teamPace?: number; // relative to league avg (1.0 = avg)
  projectedMinutesChange?: number; // % change, e.g. 0.1 = 10% more minutes
  isInjured?: boolean; // on injury report / questionable
}

export function applyAdjustments(
  baseProb: number,
  baseMean: number,
  inputs: AdjustmentInputs
): { adjustedProb: number; adjustedMean: number; breakdown: AdjustmentBreakdown } {
  let prob = baseProb;
  let mean = baseMean;
  const factors: AdjustmentFactor[] = [];

  factors.push({
    name: "base",
    label: "Base Model Probability",
    impact: 0,
    value: prob,
  });

  // Opponent defensive rank: top 5 = penalty, bottom 5 = bonus
  if (inputs.opponentDefRank !== undefined) {
    const midRank = 15.5;
    const defFactor = 1 + (inputs.opponentDefRank - midRank) * 0.005;
    const impact = (defFactor - 1) * 100;
    prob *= defFactor;
    mean *= defFactor;
    factors.push({
      name: "opponent",
      label: `vs #${inputs.opponentDefRank} Defense`,
      impact,
      value: prob,
    });
  }

  // Home/Away
  if (inputs.isHome !== undefined) {
    const haFactor = inputs.isHome ? 1.015 : 0.985;
    const impact = (haFactor - 1) * 100;
    prob *= haFactor;
    mean *= haFactor;
    factors.push({
      name: "homeAway",
      label: inputs.isHome ? "Home Game (+1.5%)" : "Away Game (-1.5%)",
      impact,
      value: prob,
    });
  }

  // Rest days
  if (inputs.restDays !== undefined) {
    let restFactor = 1.0;
    if (inputs.restDays === 0) restFactor = 0.98; // back-to-back
    else if (inputs.restDays >= 2) restFactor = 1.01;
    const impact = (restFactor - 1) * 100;
    prob *= restFactor;
    mean *= restFactor;
    factors.push({
      name: "rest",
      label: inputs.restDays === 0 ? "Back-to-Back (-2%)" : inputs.restDays >= 2 ? "2+ Days Rest (+1%)" : "1 Day Rest",
      impact,
      value: prob,
    });
  }

  // Pace factor
  if (inputs.teamPace !== undefined) {
    const paceFactor = 0.85 + 0.15 * inputs.teamPace;
    const impact = (paceFactor - 1) * 100;
    prob *= paceFactor;
    mean *= paceFactor;
    factors.push({
      name: "pace",
      label: `Pace Factor (${(inputs.teamPace * 100).toFixed(0)}% of avg)`,
      impact,
      value: prob,
    });
  }

  // Minutes projection
  if (inputs.projectedMinutesChange !== undefined && inputs.projectedMinutesChange !== 0) {
    const minFactor = 1 + inputs.projectedMinutesChange;
    const impact = inputs.projectedMinutesChange * 100;
    prob *= minFactor;
    mean *= minFactor;
    factors.push({
      name: "minutes",
      label: `Minutes ${inputs.projectedMinutesChange > 0 ? "+" : ""}${(inputs.projectedMinutesChange * 100).toFixed(0)}%`,
      impact,
      value: prob,
    });
  }

  // Injury report
  if (inputs.isInjured) {
    const injFactor = 0.92;
    const impact = (injFactor - 1) * 100;
    prob *= injFactor;
    mean *= injFactor;
    factors.push({
      name: "injury",
      label: "Injury Report (-8%)",
      impact,
      value: prob,
    });
  }

  prob = Math.max(0.01, Math.min(0.99, prob));

  const breakdown: AdjustmentBreakdown = {
    baseProb: baseProb,
    finalProb: prob,
    factors,
  };

  return { adjustedProb: prob, adjustedMean: mean, breakdown };
}

// ============================================================
// F. ENSEMBLE MODEL — weighted average of all models
// ============================================================
export interface EnsembleWeights {
  normal: number;
  poisson: number;
  skewAdjusted: number;
}

/**
 * Determine optimal weights based on stat type.
 * Poisson preferred for low-count stats; Normal for high-count.
 */
export function getEnsembleWeights(statType: string, mean: number): EnsembleWeights {
  const lowCountStats = ["rebounds", "assists", "blocks", "steals", "touchdowns", "interceptions", "sacks", "threes"];

  if (lowCountStats.includes(statType.toLowerCase()) || mean < 10) {
    return { normal: 0.3, poisson: 0.5, skewAdjusted: 0.2 };
  }
  return { normal: 0.5, poisson: 0.3, skewAdjusted: 0.2 };
}

/**
 * Generate distribution curve data for visualization.
 */
export function generateDistributionData(
  mean: number,
  stdDev: number,
): DistributionPoint[] {
  const points: DistributionPoint[] = [];
  const low = Math.max(0, mean - 4 * stdDev);
  const high = mean + 4 * stdDev;
  const step = (high - low) / 80;

  let cumulative = 0;
  for (let x = low; x <= high; x += step) {
    const pdf = normalPDF(x, mean, stdDev);
    cumulative += pdf * step;
    points.push({
      x: Math.round(x * 10) / 10,
      pdf: Math.round(pdf * 10000) / 10000,
      cdf: Math.min(1, Math.round(cumulative * 1000) / 1000),
    });
  }

  return points;
}

/**
 * MAIN ENTRY: Calculate true probability for a prop.
 * Combines all models into an ensemble prediction.
 */
export function calculateTrueProb(
  stats: PlayerStats,
  line: number,
  adjustmentInputs?: AdjustmentInputs
): {
  trueProb: number;
  modelDetails: ModelDetails;
  adjustments: AdjustmentBreakdown;
} {
  const posteriorMean = bayesianPosterior(stats);
  const stdDev = stats.stdDev > 0 ? stats.stdDev : posteriorMean * 0.25;

  // Individual model probabilities
  const nProb = normalOverProb(posteriorMean, stdDev, line);
  const pProb = poissonOverProb(posteriorMean, line);
  const gameLogValues = stats.gameLog.map((g) => g.value);
  const sProb = skewAdjustedOverProb(posteriorMean, stdDev, line, gameLogValues);

  // Ensemble
  const weights = getEnsembleWeights(stats.statType, posteriorMean);
  const ensembleProb = weights.normal * nProb + weights.poisson * pProb + weights.skewAdjusted * sProb;

  // Apply adjustments
  const { adjustedProb, breakdown } = applyAdjustments(
    ensembleProb,
    posteriorMean,
    adjustmentInputs || {}
  );

  const distributionData = generateDistributionData(posteriorMean, stdDev);

  const modelDetails: ModelDetails = {
    normalProb: Math.round(nProb * 1000) / 1000,
    poissonProb: Math.round(pProb * 1000) / 1000,
    skewAdjustedProb: Math.round(sProb * 1000) / 1000,
    ensembleProb: Math.round(ensembleProb * 1000) / 1000,
    normalWeight: weights.normal,
    poissonWeight: weights.poisson,
    skewWeight: weights.skewAdjusted,
    distributionData,
  };

  return {
    trueProb: Math.round(adjustedProb * 1000) / 1000,
    modelDetails,
    adjustments: breakdown,
  };
}
