/**
 * Cohort Engine for Partner Retention & LTV Matrix Calculation.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/cohort-engine
 */

import type {
  ClientSubscriptionRecord,
  CohortMatrixResult,
  CohortRow,
} from './types';
import {
  normalizeSingleClient,
  groupClientsByCohortMonth,
  buildCohortRow,
} from './cohort-builder';
import { computeCohortSummary } from './cohort-summary-builder';

export function computePartnerCohortMatrix(
  clients: ClientSubscriptionRecord[],
): CohortMatrixResult {
  if (!clients || clients.length === 0) {
    return {
      cohorts: [],
      summary: {
        totalClients: 0,
        activeClients: 0,
        totalMrrCents: 0,
        avgLtvCents: 0,
        projectedLtvCents: 0,
        blendedChurnPct: 0,
        avgM1RetentionPct: 0,
        avgM3RetentionPct: 0,
        overallNrrPct: 100,
        totalCohortsTracked: 0,
      },
    };
  }

  const normalized = clients.map(normalizeSingleClient);
  const cohortGroups = groupClientsByCohortMonth(normalized);
  const sortedCohortMonths = Array.from(cohortGroups.keys()).sort();

  const cohortRows: CohortRow[] = [];
  let totalM1RetentionSum = 0;
  let m1CohortCount = 0;
  let totalM3RetentionSum = 0;
  let m3CohortCount = 0;
  let totalWeightedNrrSum = 0;
  let totalCohortMrrWeight = 0;

  for (const cMonth of sortedCohortMonths) {
    const cohortMembers = cohortGroups.get(cMonth) ?? [];
    const { row, m1, m3 } = buildCohortRow(cMonth, cohortMembers);
    cohortRows.push(row);

    if (m1 !== undefined) {
      totalM1RetentionSum += m1;
      m1CohortCount++;
    }
    if (m3 !== undefined) {
      totalM3RetentionSum += m3;
      m3CohortCount++;
    }

    if (row.initialMrrCents > 0) {
      const latestPeriod = row.periods[row.periods.length - 1];
      totalWeightedNrrSum += latestPeriod.nrrPct * row.initialMrrCents;
      totalCohortMrrWeight += row.initialMrrCents;
    }
  }

  const summary = computeCohortSummary(
    normalized,
    cohortRows,
    totalM1RetentionSum,
    m1CohortCount,
    totalM3RetentionSum,
    m3CohortCount,
    totalWeightedNrrSum,
    totalCohortMrrWeight,
  );

  return { cohorts: cohortRows, summary };
}

export const computeCohortMatrix = computePartnerCohortMatrix;
