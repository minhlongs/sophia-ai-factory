/**
 * Cohort Summary Metrics Aggregator.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/cohort-summary-builder
 */

import type { CohortRow, CohortSummary } from './types';
import type { NormalizedClient } from './client-normalizer';
import { calculateProjectedLtv } from './cohort-builder';

export function computeCohortSummary(
  normalizedClients: NormalizedClient[],
  cohortRows: CohortRow[],
  m1Sum: number,
  m1Count: number,
  m3Sum: number,
  m3Count: number,
  weightedNrrSum: number,
  cohortMrrWeight: number,
): CohortSummary {
  const totalClients = normalizedClients.length;
  let activeClients = 0;
  let totalMrrCents = 0;
  let totalRevenueAllCents = 0;

  for (const client of normalizedClients) {
    if (client.isCurrentlyActive) {
      activeClients++;
      totalMrrCents += client.currentMrrCents;
    }
    totalRevenueAllCents += client.totalRevenueCents;
  }

  const avgLtvCents = totalClients > 0
    ? Math.floor(totalRevenueAllCents / totalClients)
    : 0;

  const churnedClients = Math.max(0, totalClients - activeClients);
  const blendedChurnPct = totalClients > 0
    ? Number(((churnedClients / totalClients) * 100).toFixed(2))
    : 0;

  const arpuCents = activeClients > 0
    ? Math.floor(totalMrrCents / activeClients)
    : (totalClients > 0 ? Math.floor(totalMrrCents / totalClients) : 0);

  const projectedLtvCents = calculateProjectedLtv(arpuCents, blendedChurnPct);

  const avgM1RetentionPct = m1Count > 0
    ? Number((m1Sum / m1Count).toFixed(2))
    : (totalClients > 0 ? 100 : 0);

  const avgM3RetentionPct = m3Count > 0
    ? Number((m3Sum / m3Count).toFixed(2))
    : (avgM1RetentionPct > 0 ? avgM1RetentionPct : 0);

  const overallNrrPct = cohortMrrWeight > 0
    ? Number((weightedNrrSum / cohortMrrWeight).toFixed(2))
    : 100;

  return {
    totalClients,
    activeClients,
    totalMrrCents,
    avgLtvCents,
    projectedLtvCents,
    blendedChurnPct,
    avgM1RetentionPct,
    avgM3RetentionPct,
    overallNrrPct,
    totalCohortsTracked: cohortRows.length,
  };
}
