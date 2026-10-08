/**
 * Multi-Armed Bandit Traffic Allocation Engine (Thompson Sampling & UCB1)
 * Layer: tree/growth-v13 | Max LOC: < 200 | Zero :any | Zero IO
 * @module tree/growth-v13/thompson-bandit
 */

import { BanditArm } from '@/seed/types/growth-triad-v13';
import { MAB_CONFIG } from '@/seed/config/growth/bandit-weights';

export interface BanditArmEvaluation {
  armId: string;
  expectedCvr: number;
  ucb1Score: number;
  allocatedWeight: number;
  isWinner: boolean;
}

export interface BanditEvaluationResult {
  experimentId: string;
  evaluations: BanditArmEvaluation[];
  converged: boolean;
  winningArmId: string | null;
}

function sampleBetaApproximation(alpha: number, beta: number): number {
  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
  const std = Math.sqrt(variance);
  // Box-Muller standard normal transform
  const u1 = Math.max(1e-9, Math.random());
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const sample = mean + z * std;
  return Math.min(1.0, Math.max(0.0, sample));
}

export function calculateUCB1(
  conversions: number,
  pulls: number,
  totalExperimentPulls: number,
  explorationFactor: number = MAB_CONFIG.UCB1_EXPLORATION_FACTOR
): number {
  if (pulls <= 0) return 999.0;
  const exploitation = conversions / pulls;
  const exploration = explorationFactor * Math.sqrt(Math.log(Math.max(1, totalExperimentPulls)) / pulls);
  return exploitation + exploration;
}

export function evaluateBanditExperiment(
  experimentId: string,
  arms: BanditArm[],
  totalPulls: number,
  minPullsBeforeConvergence: number = MAB_CONFIG.MIN_PULLS_BEFORE_CONVERGENCE,
  convergenceThreshold: number = MAB_CONFIG.CONFIDENCE_CONVERGENCE_THRESHOLD
): BanditEvaluationResult {
  const activeArms = arms.filter((arm) => arm.status !== 'PRUNED');
  if (activeArms.length === 0) {
    return {
      experimentId,
      evaluations: [],
      converged: false,
      winningArmId: null,
    };
  }

  const winCounts: Record<string, number> = {};
  for (const arm of activeArms) {
    winCounts[arm.id] = 0;
  }

  const rounds = MAB_CONFIG.THOMPSON_MONTE_CARLO_ROUNDS;
  for (let r = 0; r < rounds; r++) {
    let bestArmId = activeArms[0].id;
    let maxSample = -1;
    for (const arm of activeArms) {
      const sample = sampleBetaApproximation(arm.alphaSuccesses, arm.betaFailures);
      if (sample > maxSample) {
        maxSample = sample;
        bestArmId = arm.id;
      }
    }
    winCounts[bestArmId] = (winCounts[bestArmId] ?? 0) + 1;
  }

  let leadingArmId: string | null = null;
  let maxWinProb = 0;

  for (const arm of activeArms) {
    const prob = (winCounts[arm.id] ?? 0) / rounds;
    if (prob > maxWinProb) {
      maxWinProb = prob;
      leadingArmId = arm.id;
    }
  }

  const isConverged =
    totalPulls >= minPullsBeforeConvergence &&
    maxWinProb >= convergenceThreshold &&
    activeArms.length > 1;

  const evaluations: BanditArmEvaluation[] = activeArms.map((arm) => {
    const rawWeight = (winCounts[arm.id] ?? 0) / rounds;
    const clampedWeight = isConverged && arm.id === leadingArmId
      ? MAB_CONFIG.MAX_EXPLOITATION_TRAFFIC_WEIGHT
      : Math.max(MAB_CONFIG.MIN_EXPLORATION_TRAFFIC_WEIGHT, rawWeight);

    const expectedCvr = arm.pullCount > 0 ? arm.conversionCount / arm.pullCount : 0;
    const ucb1Score = calculateUCB1(arm.conversionCount, arm.pullCount, totalPulls);

    return {
      armId: arm.id,
      expectedCvr,
      ucb1Score,
      allocatedWeight: clampedWeight,
      isWinner: isConverged && arm.id === leadingArmId,
    };
  });

  const weightSum = evaluations.reduce((sum, item) => sum + item.allocatedWeight, 0);
  for (const item of evaluations) {
    item.allocatedWeight = Number((item.allocatedWeight / (weightSum || 1)).toFixed(4));
  }

  return {
    experimentId,
    evaluations,
    converged: isConverged,
    winningArmId: isConverged ? leadingArmId : null,
  };
}
