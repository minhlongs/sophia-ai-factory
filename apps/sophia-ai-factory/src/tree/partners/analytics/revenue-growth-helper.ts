/**
 * Revenue Growth & Monthly Commission Calculation Helpers.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/revenue-growth-helper
 */

import type { CohortRow } from './types';
import type { CommissionRow } from './d1-summary-helpers';

export function calculateRevenueGrowthPct(cohorts: CohortRow[]): number {
  if (cohorts.length >= 2) {
    const firstCohortMrr = cohorts[0].initialMrrCents;
    const latestCohortMrr = cohorts[cohorts.length - 1].initialMrrCents;
    if (firstCohortMrr > 0) {
      return Number((((latestCohortMrr - firstCohortMrr) / firstCohortMrr) * 100).toFixed(1));
    }
  }
  return 0;
}

export function calculateCommissionsAndMrr(
  commissions: CommissionRow[],
  currentPeriod: string,
  profileMrr?: number,
): { monthlyCommissionCents: number; totalMrrCents: number } {
  const startOfMonth = new Date(currentPeriod + '-01T00:00:00Z').getTime();
  let monthlyCommissionCents = 0;
  let totalMrrCents = 0;

  for (const c of commissions) {
    if (c.created_at >= startOfMonth) {
      monthlyCommissionCents += c.commission_cents;
    }
    totalMrrCents += c.mrr_cents;
  }

  if (profileMrr && profileMrr > 0) {
    totalMrrCents = profileMrr;
  }

  return { monthlyCommissionCents, totalMrrCents };
}
