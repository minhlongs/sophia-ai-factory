/**
 * Tree Layer: Bayesian Conjugate Prior Updater
 * Closed-form conjugate update for Beta distributions with variance dampening.
 * Layer: tree/growth-v15 | Max LOC: < 200 | Zero :any
 * @module tree/growth-v15/prior-updater
 */

import type {
  ConjugatePriorUpdateInput,
  ConjugatePriorUpdateResult,
} from '@/seed/types/growth-triad-v15';

/**
 * Computes the updated Beta distribution parameters given continuous observation
 * score in [0, 1] with dampening factor to mitigate cold-start overfitting.
 */
export function updateConjugatePrior(
  input: ConjugatePriorUpdateInput
): ConjugatePriorUpdateResult {
  const {
    currentAlpha,
    currentBeta,
    sampleSize,
    observedScore,
    dampeningFactor = 0.85,
  } = input;

  // Clamp observed score to [0, 1]
  const score = Math.max(0, Math.min(1, observedScore));
  const effectiveWeight = Math.max(1, sampleSize) * dampeningFactor;

  // Pseudo-count increments based on normalized continuous score
  const deltaAlpha = score * effectiveWeight;
  const deltaBeta = (1 - score) * effectiveWeight;

  const updatedAlpha = Math.max(0.1, currentAlpha + deltaAlpha);
  const updatedBeta = Math.max(0.1, currentBeta + deltaBeta);

  const sum = updatedAlpha + updatedBeta;
  const expectedValue = sum > 0 ? updatedAlpha / sum : 0.5;
  const variance = sum > 0 ? (updatedAlpha * updatedBeta) / (sum * sum * (sum + 1)) : 0;

  return {
    updatedAlpha,
    updatedBeta,
    expectedValue,
    variance,
  };
}
