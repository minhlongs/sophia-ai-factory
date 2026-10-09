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
import type {
  ChurnRiskLevel,
  CustomerHealthMetrics,
  HealthFactorBreakdown,
  RawCustomerActivityMetrics,
} from './types';

/**
 * 1. Factor: Recency Score (0 - 25)
 * Based on days elapsed since last session/login activity.
 * <= 1 day: 25 pts | <= 3 days: 20 pts | <= 7 days: 15 pts | <= 14 days: 10 pts | <= 30 days: 5 pts | > 30 days: 0 pts
 */
export function calculateRecencyScore(daysSinceLastActive: number): number {
  if (!Number.isFinite(daysSinceLastActive)) return 0;
  if (daysSinceLastActive < 0) return 25;
  if (daysSinceLastActive <= 1) return 25;
  if (daysSinceLastActive <= 3) return 20;
  if (daysSinceLastActive <= 7) return 15;
  if (daysSinceLastActive <= 14) return 10;
  if (daysSinceLastActive <= 30) return 5;
  return 0;
}

/**
 * 2. Factor: Velocity Score (0 - 25)
 * Based on video creation output volume in trailing 30 days.
 * >= 10 videos: 25 pts | >= 5 videos: 20 pts | >= 2 videos: 15 pts | >= 1 video: 10 pts | 0 videos: 0 pts
 */
export function calculateVelocityScore(videosCount30d: number): number {
  if (!Number.isFinite(videosCount30d) || videosCount30d <= 0) return 0;
  if (videosCount30d >= 10) return 25;
  if (videosCount30d >= 5) return 20;
  if (videosCount30d >= 2) return 15;
  if (videosCount30d >= 1) return 10;
  return 0;
}

/**
 * 3. Factor: Capacity Score (0 - 25)
 * Based on remaining MCU credits balance relative to purchased/allowance.
 * ratio >= 0.5: 25 pts | ratio >= 0.2: 20 pts | ratio >= 0.1: 15 pts | > 0: 10 pts | == 0: 0 pts
 */
export function calculateCapacityScore(
  creditsRemaining: number,
  creditsPurchased: number,
): number {
  if (Number.isNaN(creditsRemaining) || creditsRemaining <= 0) return 0;
  if (!Number.isFinite(creditsRemaining)) {
    return creditsRemaining > 0 ? 25 : 0;
  }

  if (Number.isFinite(creditsPurchased) && creditsPurchased > 0) {
    const ratio = creditsRemaining / creditsPurchased;
    if (ratio >= 0.5) return 25;
    if (ratio >= 0.2) return 20;
    if (ratio >= 0.1) return 15;
    return 10;
  }

  // Baseline when purchased is not recorded or free grant
  if (creditsRemaining >= 500) return 25;
  if (creditsRemaining >= 200) return 20;
  if (creditsRemaining >= 50) return 15;
  return 10;
}

/**
 * 4. Factor: Reliability Score (0 - 25)
 * Based on render job success rate (completed vs failed jobs).
 * >= 95%: 25 pts | >= 85%: 20 pts | >= 70%: 15 pts | >= 50%: 10 pts | < 50%: 5 pts
 * If no jobs run yet: 20 pts (neutral baseline, zero render failures)
 */
export function calculateReliabilityScore(
  completedJobs: number,
  failedJobs: number,
): number {
  const total = completedJobs + failedJobs;
  if (total === 0) return 20;

  const successRate = completedJobs / total;
  if (successRate >= 0.95) return 25;
  if (successRate >= 0.85) return 20;
  if (successRate >= 0.7) return 15;
  if (successRate >= 0.5) return 10;
  return 5;
}

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
