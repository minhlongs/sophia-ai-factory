/**
 * Tree Layer: Growth Triad v16 Bayesian Prior Script Steerer
 * Mathematical domain logic for computing prompt steering parameters
 * and retention-guided pacing from Beta conjugate distributions.
 * Layer: tree/growth-v16 | Max LOC: < 200 | Zero :any
 * @module tree/growth-v16/prior-script-steerer
 */

import type { PriorScriptSteering } from '@/seed/types/growth-triad-v16';

export interface ComputeSteeringInput {
  hookAlpha: number;
  hookBeta: number;
  retentionAlpha: number;
  retentionBeta: number;
  sampleSize: number;
  winningHookArchetype?: string;
}

export interface ComputedSteeringMetrics {
  expectedHookRetention: number;
  hookVariance: number;
  expectedOverallRetention: number;
  overallVariance: number;
  confidenceScore: number;
  steering: PriorScriptSteering;
}

/**
 * Calculates expectation and variance of Beta distribution Beta(alpha, beta).
 */
export function calculateBetaMoments(alpha: number, beta: number): { mean: number; variance: number } {
  const sum = alpha + beta;
  if (sum <= 0) return { mean: 0.5, variance: 0.0833 };
  const mean = alpha / sum;
  const variance = (alpha * beta) / (sum * sum * (sum + 1));
  return { mean, variance };
}

/**
 * Derives prompt steering constraints and pacing directives
 * from empirical Beta conjugate priors.
 */
export function derivePriorScriptSteering(input: ComputeSteeringInput): ComputedSteeringMetrics {
  const hookMoments = calculateBetaMoments(input.hookAlpha, input.hookBeta);
  const retentionMoments = calculateBetaMoments(input.retentionAlpha, input.retentionBeta);

  // Confidence is proportional to sample size and inverse variance
  const rawConfidence = Math.min(1.0, (input.sampleSize / 10) * (1 - 4 * hookMoments.variance));
  const confidenceScore = Math.max(0.1, Number(rawConfidence.toFixed(4)));

  // Target dropoff threshold: tighten if hook dropoff is historically high (low mean hook retention)
  let targetHookDropoffThreshold = 25;
  let pacingDirective = 'Balanced narration with standard scene transition cadence.';

  if (hookMoments.mean < 0.5) {
    targetHookDropoffThreshold = 18;
    pacingDirective = 'High-velocity 3-second hook with immediate visual disruption and concise question.';
  } else if (hookMoments.mean >= 0.75) {
    targetHookDropoffThreshold = 30;
    pacingDirective = 'Storytelling hook with strong curiosity gap and gradual value unfolding.';
  }

  // Retention multiplier reflects relative expected completion vs baseline (0.5)
  const retentionMultiplier = Number((1.0 + Math.max(0, (retentionMoments.mean - 0.5) * 0.8)).toFixed(3));

  const steering: PriorScriptSteering = {
    targetHookDropoffThreshold,
    expectedRetentionMultiplier: retentionMultiplier,
    winningHookArchetype: input.winningHookArchetype ?? (hookMoments.mean >= 0.6 ? 'Curiosity Gap / Contrast' : 'Pattern Interrupt'),
    pacingDirective,
    dimensionWeights: {
      hook: Number(hookMoments.mean.toFixed(3)),
      overallRetention: Number(retentionMoments.mean.toFixed(3)),
      confidence: confidenceScore,
    },
  };

  return {
    expectedHookRetention: Number(hookMoments.mean.toFixed(4)),
    hookVariance: Number(hookMoments.variance.toFixed(6)),
    expectedOverallRetention: Number(retentionMoments.mean.toFixed(4)),
    overallVariance: Number(retentionMoments.variance.toFixed(6)),
    confidenceScore,
    steering,
  };
}
