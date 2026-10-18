/**
 * Period-level retention, churn, and projected LTV calculators for Cohort Analytics.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/cohort-period-calculator
 */

import type { CohortPeriodMetric } from './types';
import type { NormalizedClient } from './client-normalizer';

function countPeriodActivity(
  k: number,
  actMonth: string,
  cohortMembers: NormalizedClient[],
  initialSize: number,
): { activeCount: number; monthMrrCents: number } {
  let activeCount = 0;
  let monthMrrCents = 0;

  for (const member of cohortMembers) {
    if (k === 0) {
      const val = member.activityMap.get(actMonth) ?? member.currentMrrCents ?? 0;
      if (val > 0 || member.activityMap.has(actMonth) || member.isCurrentlyActive) {
        activeCount++;
      }
      monthMrrCents += val;
    } else {
      const val = member.activityMap.get(actMonth);
      if (val !== undefined && val > 0) {
        activeCount++;
        monthMrrCents += val;
      }
    }
  }

  if (k === 0 && activeCount === 0 && initialSize > 0) {
    activeCount = initialSize;
  }

  return { activeCount, monthMrrCents };
}

export function calculateCohortPeriodMetric(
  k: number,
  actMonth: string,
  cohortMembers: NormalizedClient[],
  initialSize: number,
  initialMrrCents: number,
): CohortPeriodMetric {
  const { activeCount, monthMrrCents } = countPeriodActivity(k, actMonth, cohortMembers, initialSize);

  const logoRetentionPct = initialSize > 0
    ? Number(((activeCount / initialSize) * 100).toFixed(2))
    : 0;

  const logoChurnPct = Number((Math.max(0, 100 - logoRetentionPct)).toFixed(2));

  const nrrPct = initialMrrCents > 0
    ? Number(((monthMrrCents / initialMrrCents) * 100).toFixed(2))
    : (activeCount > 0 ? 100 : 0);

  const mrrChurnPct = Number((Math.max(0, 100 - nrrPct)).toFixed(2));

  return {
    monthIndex: k,
    activityMonth: actMonth,
    activeClients: activeCount,
    logoRetentionPct,
    mrrCents: monthMrrCents,
    nrrPct,
    logoChurnPct,
    mrrChurnPct,
  };
}

export function calculateProjectedLtv(arpuCents: number, blendedChurnPct: number): number {
  const GROSS_MARGIN_PCT = 0.82;
  if (blendedChurnPct > 0) {
    const monthlyChurnRateDecimal = blendedChurnPct / 100;
    return Math.floor((arpuCents * GROSS_MARGIN_PCT) / monthlyChurnRateDecimal);
  }
  return Math.floor(arpuCents * GROSS_MARGIN_PCT * 36);
}
