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
import {
  calculateCohortPeriodMetric,
  calculateProjectedLtv,
} from './cohort-period-calculator';

export {
  normalizeSingleClient,
  groupClientsByCohortMonth,
  type NormalizedClient,
} from './client-normalizer';

export {
  calculateCohortPeriodMetric,
  calculateProjectedLtv,
};

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
