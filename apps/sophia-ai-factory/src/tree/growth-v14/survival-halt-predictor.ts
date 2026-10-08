/**
 * Tree Layer: Bayesian Early-Halt Survival Predictor
 * Evaluates interim stage-1 rendering metrics to predict final retention survival and halt non-performing renders.
 * Layer: tree/growth-v14 | Max LOC: < 200 | Zero :any | Zero IO
 * @module tree/growth-v14/survival-halt-predictor
 */

import { SurvivalPredictionParams } from '@/seed/types/growth-triad-v14';

export interface EarlyHaltDecision {
  shouldHalt: boolean;
  posteriorRetentionMean: number;
  retentionPercentile: number;
  projectedMcuSavingsPct: number;
  reason: string;
}

/**
 * Evaluates Stage 1 synthesis milestone against Bayesian retention conjugate prior (Beta-Binomial).
 * If predicted retention drops below the critical threshold, signals immediate rendering abort,
 * saving ~65% of remaining GPU MCU synthesis compute.
 */
export function evaluateEarlyHaltSurvival(
  params: SurvivalPredictionParams
): EarlyHaltDecision {
  const {
    interimRetentionScore,
    priorAlpha,
    priorBeta,
    sampleSize,
    criticalCutoffPercentile,
  } = params;

  // Convert continuous interim score (0-1) into effective Bayesian observation
  const effectiveSuccesses = interimRetentionScore * sampleSize;
  const effectiveFailures = sampleSize - effectiveSuccesses;

  // Posterior Beta distribution parameters
  const posteriorAlpha = priorAlpha + effectiveSuccesses;
  const posteriorBeta = priorBeta + effectiveFailures;

  // Posterior expectation: E[theta] = alpha / (alpha + beta)
  const posteriorRetentionMean = posteriorAlpha / (posteriorAlpha + posteriorBeta);

  // Normal approximation to Beta CDF for percentile estimation
  const variance =
    (posteriorAlpha * posteriorBeta) /
    (Math.pow(posteriorAlpha + posteriorBeta, 2) * (posteriorAlpha + posteriorBeta + 1));
  const stdDev = Math.sqrt(Math.max(1e-6, variance));

  // Z-Score relative to baseline expected retention (prior mean)
  const priorMean = priorAlpha / (priorAlpha + priorBeta);
  const zScore = (posteriorRetentionMean - priorMean) / stdDev;

  // Approximate standard normal CDF: Phi(z)
  const retentionPercentile = approximateNormalCdf(zScore);

  const shouldHalt = retentionPercentile < criticalCutoffPercentile;

  // Stage 1 frames consume ~35% of total compute. Halting saves remaining ~65%.
  const projectedMcuSavingsPct = shouldHalt ? 65.0 : 0.0;

  const reason = shouldHalt
    ? `Stage 1 retention percentile (${(retentionPercentile * 100).toFixed(1)}%) dropped below critical safety cutoff (${(criticalCutoffPercentile * 100).toFixed(1)}%). Halting to preserve GPU MCU budget.`
    : `Interim retention percentile (${(retentionPercentile * 100).toFixed(1)}%) satisfies survival viability threshold. Rendering approved for completion.`;

  return {
    shouldHalt,
    posteriorRetentionMean: Number(posteriorRetentionMean.toFixed(4)),
    retentionPercentile: Number(retentionPercentile.toFixed(4)),
    projectedMcuSavingsPct,
    reason,
  };
}

/**
 * Standard normal cumulative distribution function approximation (Abramowitz and Stegun).
 */
function approximateNormalCdf(z: number): number {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2.0);
  const prob =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1.0 - prob : prob;
}
