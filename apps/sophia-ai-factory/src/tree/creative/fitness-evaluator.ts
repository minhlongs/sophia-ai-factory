/**
 * @file fitness-evaluator.ts
 * @description Darwinian fitness score & parent-offspring promotion evaluator
 * @layer tree
 */

import type { FitnessEvaluation } from '@/seed/types/creative-mutator-types';

export const PROMOTION_GAIN_THRESHOLD_PERCENT = 15;

/**
 * Calculates Composite Fitness:
 * 50% Hook Score + 35% Retention Score + 15% Capped ROI (max 100)
 */
export function calculateFitnessScore(
  hookScore: number,
  retentionScore: number,
  roiPercent: number,
): number {
  const boundedHook = Math.max(0, Math.min(100, hookScore));
  const boundedRetention = Math.max(0, Math.min(100, retentionScore));
  const boundedRoi = Math.max(0, Math.min(100, roiPercent));

  const composite = 0.5 * boundedHook + 0.35 * boundedRetention + 0.15 * boundedRoi;
  return Math.round(composite * 10) / 10;
}

/**
 * Evaluates offspring fitness and determines if it qualifies as PROMOTED_OFFSPRING
 */
export function evaluateOffspringFitness(
  parentFitness: number,
  offspringMetrics: {
    hookScore: number;
    retentionScore: number;
    roiPercent: number;
  },
): FitnessEvaluation {
  const compositeFitness = calculateFitnessScore(
    offspringMetrics.hookScore,
    offspringMetrics.retentionScore,
    offspringMetrics.roiPercent,
  );

  const baseline = parentFitness > 0 ? parentFitness : 1;
  const gainVsParentPercent = Math.round(((compositeFitness - parentFitness) / baseline) * 1000) / 10;
  const isPromotedOffspring = gainVsParentPercent >= PROMOTION_GAIN_THRESHOLD_PERCENT;

  return {
    hookScore: offspringMetrics.hookScore,
    retentionScore: offspringMetrics.retentionScore,
    roiPercent: offspringMetrics.roiPercent,
    compositeFitness,
    isPromotedOffspring,
    gainVsParentPercent,
  };
}
