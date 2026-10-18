/**
 * Customer Retention Health Score Calculator.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/health-calculator
 */

import {
  CHURN_HEALTH_THRESHOLD,
  WARNING_HEALTH_THRESHOLD,
  computeSafeLastActiveAt,
} from './constants';
import {
  calculateCapacityScore,
  calculateRecencyScore,
  calculateReliabilityScore,
  calculateVelocityScore,
} from './health-factor-scores';
import type {
  ChurnRiskLevel,
  CustomerHealthMetrics,
  HealthFactorBreakdown,
  RawCustomerActivityMetrics,
} from './types';

export {
  calculateRecencyScore,
  calculateVelocityScore,
  calculateCapacityScore,
  calculateReliabilityScore,
};

/**
 * Pure calculation function: determines 4 health factor scores and status.
 */
export function computeCustomerHealth(
  raw: RawCustomerActivityMetrics,
): CustomerHealthMetrics {
  const recencyScore = calculateRecencyScore(raw.daysSinceLastActive);
  const velocityScore = calculateVelocityScore(raw.videosCreated30d);
  const capacityScore = calculateCapacityScore(
    raw.creditsRemaining,
    raw.creditsPurchased,
  );
  const reliabilityScore = calculateReliabilityScore(
    raw.completedJobs,
    raw.failedJobs,
  );

  const rawSum =
    recencyScore + velocityScore + capacityScore + reliabilityScore;
  const isScoreFinite = Number.isFinite(rawSum);
  const totalHealthScore = isScoreFinite
    ? Math.max(0, Math.min(100, rawSum))
    : 0;

  let status: ChurnRiskLevel = 'HEALTHY';
  if (!isScoreFinite || totalHealthScore < CHURN_HEALTH_THRESHOLD) {
    status = 'CRITICAL_CHURN_RISK';
  } else if (totalHealthScore < WARNING_HEALTH_THRESHOLD) {
    status = 'WARNING';
  }

  const breakdown: HealthFactorBreakdown = {
    recency: recencyScore,
    velocity: velocityScore,
    capacity: capacityScore,
    reliability: reliabilityScore,
  };

  return {
    userId: raw.userId,
    userEmail: raw.userEmail,
    userName: raw.userName ?? undefined,
    recencyScore,
    velocityScore,
    capacityScore,
    reliabilityScore,
    totalHealthScore,
    status,
    lastActiveAt: computeSafeLastActiveAt(
      raw.lastActiveAt,
      raw.daysSinceLastActive,
    ),
    breakdown,
    rawMetrics: raw,
  };
}
