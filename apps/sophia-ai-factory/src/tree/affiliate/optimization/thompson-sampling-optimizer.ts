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
  totalCostCents?: number;
  priorAlpha?: number;
  priorBeta?: number;
}

export interface ThompsonSelectionResult {
  selectedArmId: string;
  armName: string;
  sampledProbability: number;
  estimatedConversionRate: number;
  expectedNetContributionCents?: number;
  propensity?: number;
}

export interface OptimalPersonaArmResult extends ThompsonSelectionResult {
  hookAngle: string;
  personaGender: PersonaArmGender;
  voiceDialect: string;
}

/**
 * Selects the optimal composite persona arm (hook angle, persona gender, voice dialect)
 * using Bayesian Bernoulli Thompson Sampling combined with expected net contribution.
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
 * Balances exploitation and exploration seamlessly by sampling each arm's posterior distribution,
 * weighted by expected net contribution (reward - cost) and providing propensity scores.
 */
export function selectHookWithThompsonSampling(
  arms: ThompsonHookArm[],
  random: () => number = Math.random,
): ThompsonSelectionResult {
  if (arms.length === 0) {
    throw new Error('Cannot select hook from empty arms list');
  }

  let bestArm = arms[0];
  let maxScore = -Infinity;
  const samples: { arm: ThompsonHookArm; score: number }[] = [];

  for (const arm of arms) {
    const alpha = (arm.priorAlpha ?? 1) + arm.conversions;
    const beta = (arm.priorBeta ?? 1) + Math.max(0, arm.impressions - arm.conversions);

    const conversionSample = sampleBeta(alpha, beta, random);

    // 2027 Net Contribution Weighting:
    // If costs and rewards are tracked, weight the sampled probability by average net contribution per conversion
    const totalCost = arm.totalCostCents ?? 0;
    const netReward = arm.totalRewardCents - totalCost;
    const avgNetPerConversion = arm.conversions > 0
      ? Math.max(1, netReward / arm.conversions)
      : Math.max(1, netReward > 0 ? netReward : 100);

    // Score is sample probability scaled by net reward factor (or conversionSample if rewards are neutral)
    const score = arm.totalRewardCents > 0 || totalCost > 0
      ? conversionSample * (avgNetPerConversion / 100)
      : conversionSample;

    samples.push({ arm, score });

    if (score > maxScore) {
      maxScore = score;
      bestArm = arm;
    }
  }

  const estimatedRate = bestArm.impressions > 0
    ? bestArm.conversions / bestArm.impressions
    : 0;

  const totalCost = bestArm.totalCostCents ?? 0;
  const expectedNetContributionCents = bestArm.conversions > 0
    ? Math.round((bestArm.totalRewardCents - totalCost) / bestArm.conversions)
    : Math.round(bestArm.totalRewardCents - totalCost);

  // Propensity estimation using softmax temperature over scores for off-policy evaluation
  const expScores = samples.map(s => Math.exp(Math.min(20, Math.max(-20, s.score))));
  const sumExp = expScores.reduce((a, b) => a + b, 0);
  const bestIndex = samples.findIndex(s => s.arm.id === bestArm.id);
  const propensity = sumExp > 0 && bestIndex >= 0 ? expScores[bestIndex] / sumExp : 1 / arms.length;

  return {
    selectedArmId: bestArm.id,
    armName: bestArm.name,
    sampledProbability: maxScore,
    estimatedConversionRate: estimatedRate,
    expectedNetContributionCents,
    propensity,
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
