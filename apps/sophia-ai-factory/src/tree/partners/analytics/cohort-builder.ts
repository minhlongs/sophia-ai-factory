/**
 * Cohort Normalization & Metrics Calculation Builder.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/cohort-builder
 */

import type {
  CohortPeriodMetric,
  CohortRow,
} from './types';
import { diffMonths, addMonths } from './date-utils';
import type { NormalizedClient } from './client-normalizer';

export {
  normalizeSingleClient,
  groupClientsByCohortMonth,
  type NormalizedClient,
} from './client-normalizer';

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

export function buildCohortRow(
  cMonth: string,
  cohortMembers: NormalizedClient[],
): { row: CohortRow; m1?: number; m3?: number } {
  const initialSize = cohortMembers.length;
  let initialMrrCents = 0;
  let cohortTotalRevenueCents = 0;
  let maxMonthIndex = 0;

  for (const member of cohortMembers) {
    cohortTotalRevenueCents += member.totalRevenueCents;
    const m0Mrr = member.activityMap.get(cMonth) ?? member.currentMrrCents ?? 0;
    initialMrrCents += m0Mrr;
    for (const actMonth of member.activityMap.keys()) {
      const diff = diffMonths(cMonth, actMonth);
      if (diff > maxMonthIndex) {
        maxMonthIndex = diff;
      }
    }
  }

  const periods: CohortPeriodMetric[] = [];
  let m1: number | undefined;
  let m3: number | undefined;

  for (let k = 0; k <= maxMonthIndex; k++) {
    const actMonth = addMonths(cMonth, k);
    const metric = calculateCohortPeriodMetric(k, actMonth, cohortMembers, initialSize, initialMrrCents);
    periods.push(metric);
    if (k === 1) m1 = metric.logoRetentionPct;
    if (k === 3) m3 = metric.logoRetentionPct;
  }

  const realizedLtvCents = initialSize > 0
    ? Math.floor(cohortTotalRevenueCents / initialSize)
    : 0;

  const latestPeriod = periods[periods.length - 1];
  const currentActiveSize = latestPeriod ? latestPeriod.activeClients : initialSize;

  return {
    row: {
      cohortMonth: cMonth,
      initialSize,
      initialMrrCents,
      totalRealizedRevenueCents: cohortTotalRevenueCents,
      realizedLtvCents,
      periods,
      currentActiveSize,
    },
    m1,
    m3,
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
