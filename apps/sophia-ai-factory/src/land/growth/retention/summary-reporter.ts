/**
 * Customer Retention Portfolio Summary Reporter.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/summary-reporter
 */

import { listAllCustomerHealthMetrics } from './activity-aggregator';
import type { RetentionSummaryStats } from './types';

/**
 * Computes high-level retention & churn risk summary statistics.
 */
export async function getRetentionSummaryStats(): Promise<RetentionSummaryStats> {
  const all = await listAllCustomerHealthMetrics({ limit: 100 });
  const total = all.length;

  let healthy = 0;
  let warning = 0;
  let critical = 0;
  let sumScore = 0;
  let validScoreCount = 0;
  let winBackEligible = 0;

  for (const item of all) {
    if (Number.isFinite(item.totalHealthScore)) {
      sumScore += item.totalHealthScore;
      validScoreCount++;
    }
    if (item.status === 'HEALTHY') healthy++;
    else if (item.status === 'WARNING') warning++;
    else if (item.status === 'CRITICAL_CHURN_RISK') {
      critical++;
      if (!item.inCooldown) winBackEligible++;
    }
  }

  const averageHealthScore =
    validScoreCount > 0
      ? Math.round(sumScore / validScoreCount)
      : total > 0
        ? 0
        : 100;

  return {
    totalMonitored: total,
    healthyCount: healthy,
    warningCount: warning,
    criticalRiskCount: critical,
    averageHealthScore,
    winBackEligibleCount: winBackEligible,
    lastScanTimestamp: new Date().toISOString(),
  };
}
