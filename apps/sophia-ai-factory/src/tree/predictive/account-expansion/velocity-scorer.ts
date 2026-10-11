/**
 * Velocity & Expansion Readiness Scorer
 *
 * Milestone: GATE 9: $2,500,000 MRR ($30M ARR, 10,000 Customers, $250 ARPU, Cohort NRR >= 135%)
 * Layer: tree/predictive (Pure domain scoring logic)
 *
 * @module tree/predictive/account-expansion/velocity-scorer
 */

import type {
  CustomerTelemetryFeatures,
  ExpansionStage,
  PredictiveAction,
} from '@/seed/types/predictive-expansion';

export function calculateExpansionReadiness(features: CustomerTelemetryFeatures): {
  expansionReadinessScore: number;
  expansionStage: ExpansionStage;
  recommendedAction: PredictiveAction;
} {
  const quotaSat = features.quotaMcuMonthly > 0
    ? features.usedMcuMonthly / features.quotaMcuMonthly
    : 0;

  const usageVelocity = features.videoGenerationsPrev30d > 0
    ? (features.videoGenerationsLast7d * 4 - features.videoGenerationsPrev30d) / features.videoGenerationsPrev30d
    : 0;

  const tenureScore = Math.min(1.0, Math.max(0.0, features.tenureDays / 90));
  const featureScore = Math.min(1.0, Math.max(0.0, features.featuresUsedCount / 8));
  const errorRate = features.apiRequestsCount > 0 ? features.apiErrorsCount / features.apiRequestsCount : 0;
  const healthScore = Math.max(0.0, Math.min(1.0, 1.0 - errorRate * 5));

  const rawScore =
    0.30 * Math.min(1.0, Math.max(0.0, quotaSat)) +
    0.25 * Math.min(1.0, Math.max(0.0, usageVelocity)) +
    0.15 * tenureScore +
    0.15 * featureScore +
    0.15 * healthScore;

  const expansionReadinessScore = Number(Math.min(1.0, Math.max(0.0, rawScore)).toFixed(4));

  let expansionStage: ExpansionStage = 'nurture';
  let recommendedAction: PredictiveAction = 'maintain';

  if (expansionReadinessScore >= 0.75) {
    expansionStage = 'ready';
    if (features.currentTier === 'ENTERPRISE') {
      recommendedAction = 'enterprise_gpu_lane';
    } else {
      recommendedAction = 'tier_upgrade';
    }
  } else if (expansionReadinessScore >= 0.55) {
    expansionStage = 'engaged';
    recommendedAction = quotaSat >= 0.80 ? 'quota_expansion' : 'maintain';
  }

  return { expansionReadinessScore, expansionStage, recommendedAction };
}
