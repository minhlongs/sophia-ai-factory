/**
 * UCB1 Multi-Armed Bandit Hook Optimizer
 *
 * Optimizes video hooks and campaign angles based on actual affiliate commission
 * revenue feedback using the Upper Confidence Bound 1 (UCB1) algorithm.
 *
 * Layer: tree/affiliate/optimization (Domain Logic)
 * @module tree/affiliate/optimization/mab-hook-optimizer
 */

export interface HookArm {
  id: string;
  name: string;
  niche: 'saas_global' | 'crypto_global';
  impressions: number;
  totalRewardCents: number; // accumulated affiliate commission in USD cents
}

export interface Ucb1SelectionResult {
  selectedArmId: string;
  armName: string;
  ucbScore: number;
  isExploration: boolean;
}

/**
 * Calculates the Upper Confidence Bound score for a given arm.
 * Formula: UCB1 = x_bar + explorationParam * sqrt(2 * ln(N) / n_i)
 */
export function calculateUcb1Score(
  arm: HookArm,
  totalPullsAllArms: number,
  explorationParam = 1.414,
): number {
  if (arm.impressions === 0) {
    return Number.POSITIVE_INFINITY; // Always explore unpulled arms first
  }

  const averageReward = arm.totalRewardCents / arm.impressions;
  const explorationTerm = explorationParam * Math.sqrt((2 * Math.log(totalPullsAllArms)) / arm.impressions);

  return averageReward + explorationTerm;
}

/**
 * Selects the optimal video hook angle across candidate arms.
 */
export function selectBestHookArm(
  arms: HookArm[],
  explorationParam = 1.414,
): Ucb1SelectionResult {
  if (arms.length === 0) {
    throw new Error('Cannot select hook from empty arms list');
  }

  // 1. Identify any completely unpulled arms for exploration
  const unpulled = arms.find((a) => a.impressions === 0);
  if (unpulled) {
    return {
      selectedArmId: unpulled.id,
      armName: unpulled.name,
      ucbScore: Number.POSITIVE_INFINITY,
      isExploration: true,
    };
  }

  const totalPulls = arms.reduce((acc, a) => acc + a.impressions, 0);

  let bestArm = arms[0];
  let maxScore = Number.NEGATIVE_INFINITY;

  for (const arm of arms) {
    const score = calculateUcb1Score(arm, totalPulls, explorationParam);
    if (score > maxScore) {
      maxScore = score;
      bestArm = arm;
    }
  }

  return {
    selectedArmId: bestArm.id,
    armName: bestArm.name,
    ucbScore: maxScore,
    isExploration: false,
  };
}

/**
 * Updates an arm's performance metrics when an affiliate conversion postback arrives.
 */
export function recordConversionReward(
  arm: HookArm,
  commissionCents: number,
): HookArm {
  return {
    ...arm,
    totalRewardCents: arm.totalRewardCents + commissionCents,
  };
}
