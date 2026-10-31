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
  /**
   * Logging policy selection probability or empirical win fraction estimate.
   * Note: This is strictly the logging propensity P(arm = argmax | history).
   * It MUST NOT be used for off-policy evaluation (IPS/DR) claims without verified
   * common support across the target policy.
   */
  propensity?: number;
  /** True when propensity is estimated via Monte Carlo simulation rather than exact analytical calculation */
  isEstimatedPropensity?: boolean;
  /** Number of Monte Carlo draws used for estimation */
  monteCarloSampleSize?: number;
  /**
   * Explicit guard: OPE (IPS/DR) requires unbiased support and full target-policy overlap.
   * Single-arm deterministic choices (support = 0 for other arms) and floored multi-arm Monte Carlo
   * estimates are strictly marked false because they cannot support unbiased off-policy evaluation.
   */
  opeUnbiasedCertified: false;
  /** Exact selection probability when known analytically under logging policy (e.g. single candidate arm = 1.0) */
  exactPolicyProbability?: number;
  /** Diagnostic flag when the selected arm has negative expected unit contribution */
  isMarginNegative?: boolean;
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
 * weighted by expected net contribution (reward - cost) and estimating true selection propensity.
 */
export function selectHookWithThompsonSampling(
  arms: ThompsonHookArm[],
  random: () => number = Math.random,
): ThompsonSelectionResult {
  if (arms.length === 0) {
    throw new Error('Cannot select hook from empty arms list');
  }

  // Helper to compute an arm's score given a sampled conversion rate
  function computeArmScore(arm: ThompsonHookArm, conversionSample: number): {
    score: number;
    expectedNetContributionCents: number;
  } {
    const totalCost = arm.totalCostCents ?? 0;
    const netReward = arm.totalRewardCents - totalCost;
    // Real unit economics: average net contribution per conversion (or net reward if 0 conversions)
    const avgNetPerConversion = arm.conversions > 0
      ? netReward / arm.conversions
      : (arm.totalRewardCents > 0 || totalCost > 0 ? netReward : 0);

    let score: number;
    if (arm.totalRewardCents > 0 || totalCost > 0) {
      if (avgNetPerConversion >= 0) {
        // Scaled positive expected return (normalized to dollars factor)
        score = conversionSample * (avgNetPerConversion / 100);
      } else {
        // Preserves negative sign: loss-making arms are penalized proportionally to expected loss
        // A conversion on a loss-making arm incurs loss, so higher conversion rate means higher total loss!
        score = conversionSample * (avgNetPerConversion / 100);
      }
    } else {
      score = conversionSample;
    }

    const expectedNetContributionCents = arm.conversions > 0
      ? Math.round(netReward / arm.conversions)
      : Math.round(netReward);

    return { score, expectedNetContributionCents };
  }

  // Helper to get exact posterior alpha and beta without double counting
  function getPosteriorParams(arm: ThompsonHookArm): { alpha: number; beta: number } {
    // If priorAlpha/priorBeta already represent the full posterior (from DB), use them directly
    const alpha = arm.priorAlpha !== undefined ? arm.priorAlpha : (1 + arm.conversions);
    const beta = arm.priorBeta !== undefined ? arm.priorBeta : (1 + Math.max(0, arm.impressions - arm.conversions));
    return { alpha, beta };
  }

  let bestArm = arms[0];
  let maxScore = -Infinity;
  let bestNetContributionCents = 0;

  for (const arm of arms) {
    const { alpha, beta } = getPosteriorParams(arm);
    const conversionSample = sampleBeta(alpha, beta, random);
    const { score, expectedNetContributionCents } = computeArmScore(arm, conversionSample);

    if (score > maxScore) {
      maxScore = score;
      bestArm = arm;
      bestNetContributionCents = expectedNetContributionCents;
    }
  }

  const estimatedRate = bestArm.impressions > 0
    ? bestArm.conversions / bestArm.impressions
    : 0;

  // If only 1 arm exists, exact analytical selection probability under logging policy is 1.0.
  // However, opeUnbiasedCertified MUST REMAIN FALSE because a single-arm logging policy has ZERO support
  // for any alternative counterfactual arm, making off-policy evaluation (IPS/DR) mathematically undefined/biased.
  if (arms.length === 1) {
    return {
      selectedArmId: bestArm.id,
      armName: bestArm.name,
      sampledProbability: maxScore,
      estimatedConversionRate: estimatedRate,
      expectedNetContributionCents: bestNetContributionCents,
      propensity: 1.0,
      exactPolicyProbability: 1.0,
      isEstimatedPropensity: false,
      monteCarloSampleSize: 0,
      opeUnbiasedCertified: false,
      isMarginNegative: bestNetContributionCents < 0,
    };
  }

  // Multi-arm policy: Monte Carlo simulation to estimate empirical win probability P(arm_i = argmax).
  const MC_DRAWS = 100;
  const winCounts = new Map<string, number>();
  for (const arm of arms) {
    winCounts.set(arm.id, 0);
  }

  for (let d = 0; d < MC_DRAWS; d++) {
    let drawMaxScore = -Infinity;
    let drawWinningArmId = arms[0].id;

    for (const arm of arms) {
      const { alpha, beta } = getPosteriorParams(arm);
      const sample = sampleBeta(alpha, beta, random);
      const { score } = computeArmScore(arm, sample);
      if (score > drawMaxScore) {
        drawMaxScore = score;
        drawWinningArmId = arm.id;
      }
    }
    winCounts.set(drawWinningArmId, (winCounts.get(drawWinningArmId) ?? 0) + 1);
  }

  // Empirical win fraction. Note: clipping [0.01, 0.99] is a numerical heuristic for IPS denominator stability;
  // it is NOT Laplace smoothing or a Clopper-Pearson interval. Any clipped estimate is marked opeUnbiasedCertified: false!
  const rawPropensity = (winCounts.get(bestArm.id) ?? 0) / MC_DRAWS;
  const propensity = Math.max(0.01, Math.min(0.99, rawPropensity));

  return {
    selectedArmId: bestArm.id,
    armName: bestArm.name,
    sampledProbability: maxScore,
    estimatedConversionRate: estimatedRate,
    expectedNetContributionCents: bestNetContributionCents,
    propensity,
    isEstimatedPropensity: true,
    monteCarloSampleSize: MC_DRAWS,
    opeUnbiasedCertified: false, // Explicitly tagged: clipped MC cannot claim unbiased OPE
    isMarginNegative: bestNetContributionCents < 0,
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
