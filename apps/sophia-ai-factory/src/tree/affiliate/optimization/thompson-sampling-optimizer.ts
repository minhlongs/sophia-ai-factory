/**
 * Thompson Sampling Multi-Armed Bandit Hook Optimizer
 *
 * Implements Bayesian Bernoulli Thompson Sampling for affiliate video hook angles.
 * Samples from Beta(alpha, beta) distributions where:
 * - alpha = 1 + conversions (successes)
 * - beta = 1 + non-converting impressions (failures)
 *
 * Layer: tree/affiliate/optimization (Domain Logic)
 * @module tree/affiliate/optimization/thompson-sampling-optimizer
 */

import { sampleBeta } from './beta-distribution-sampler';
import {
  decodePersonaArmKey,
  type PersonaArmGender,
} from './persona-arm-codec';

export { sampleGamma, sampleBeta, seededRandom } from './beta-distribution-sampler';

export interface ThompsonHookArm {
  id: string;
  name: string;
  niche: 'saas_global' | 'crypto_global' | 'ecommerce_tiktok';
  impressions: number;
  conversions: number;
  totalRewardCents: number;
  priorAlpha?: number;
  priorBeta?: number;
}

export interface ThompsonSelectionResult {
  selectedArmId: string;
  armName: string;
  sampledProbability: number;
  estimatedConversionRate: number;
}

export interface OptimalPersonaArmResult extends ThompsonSelectionResult {
  hookAngle: string;
  personaGender: PersonaArmGender;
  voiceDialect: string;
}

/**
 * Selects the optimal composite persona arm (hook angle, persona gender, voice dialect)
 * using Bayesian Bernoulli Thompson Sampling.
 */
export function selectOptimalPersonaGenderArm(
  arms: ThompsonHookArm[],
  random: () => number = Math.random,
): OptimalPersonaArmResult {
  const result = selectHookWithThompsonSampling(arms, random);
  const decoded = decodePersonaArmKey(result.selectedArmId);

  return {
    ...result,
    hookAngle: decoded?.hookAngle ?? result.armName,
    personaGender: decoded?.personaGender ?? 'female',
    voiceDialect: decoded?.voiceDialect ?? 'en-US',
  };
}

/**
 * Selects the optimal hook arm using Thompson Sampling.
 * Balances exploitation and exploration seamlessly by sampling each arm's posterior distribution.
 */
export function selectHookWithThompsonSampling(
  arms: ThompsonHookArm[],
  random: () => number = Math.random,
): ThompsonSelectionResult {
  if (arms.length === 0) {
    throw new Error('Cannot select hook from empty arms list');
  }

  let bestArm = arms[0];
  let maxSample = -1;

  for (const arm of arms) {
    const alpha = (arm.priorAlpha ?? 1) + arm.conversions;
    const beta = (arm.priorBeta ?? 1) + Math.max(0, arm.impressions - arm.conversions);

    const sample = sampleBeta(alpha, beta, random);

    if (sample > maxSample) {
      maxSample = sample;
      bestArm = arm;
    }
  }

  const estimatedRate = bestArm.impressions > 0
    ? bestArm.conversions / bestArm.impressions
    : 0;

  return {
    selectedArmId: bestArm.id,
    armName: bestArm.name,
    sampledProbability: maxSample,
    estimatedConversionRate: estimatedRate,
  };
}

/**
 * Records an affiliate postback event (impressions and conversions) for an arm.
 */
export function recordThompsonFeedback(
  arm: ThompsonHookArm,
  conversionsCount: number,
  rewardCents: number,
  impressionsCount: number = 0,
): ThompsonHookArm {
  // Beta failures are derived from impressions - conversions. Omitting
  // impressionsCount (the old behaviour) made the posterior mathematically
  // wrong; the caller must supply the observed cohort size.
  return {
    ...arm,
    impressions: arm.impressions + impressionsCount,
    conversions: arm.conversions + conversionsCount,
    totalRewardCents: arm.totalRewardCents + rewardCents,
  };
}
