/**
 * D1 Partner Analytics Summary Aggregator.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/d1-summary
 */

import type { PartnerTier } from '@/tree/partners/types';
import type { PartnerAnalyticsSummary } from './types';
import { formatYearMonth } from './date-utils';
import { computePartnerCohortMatrix } from './cohort-engine';
import {
  fetchPartnerProfile,
  fetchPartnerCommissions,
  fetchPartnerPoolStats,
  groupCommissionsByClient,
  buildSubClientMetrics,
  calculateRevenueGrowthPct,
  calculateCommissionsAndMrr,
} from './d1-summary-helpers';

/**
 * Aggregates client metrics, top sub-clients, and revenue growth for a partner.
 *
 * @param db D1Database client instance
 * @param partnerId ID of the partner
 * @returns Complete PartnerAnalyticsSummary
 */
export async function getPartnerAnalyticsSummary(
  db: D1Database,
  partnerId: string,
): Promise<PartnerAnalyticsSummary> {
  const currentPeriod = formatYearMonth(Date.now());
  const now = Date.now();

  const [profile, commissions, poolStats] = await Promise.all([
    fetchPartnerProfile(db, partnerId),
    fetchPartnerCommissions(db, partnerId),
    fetchPartnerPoolStats(db, partnerId),
  ]);

  const partnerName = profile?.partner_name ?? 'Partner';
  const tier: PartnerTier = profile?.tier ?? 'SILVER';
  const totalMcuAllocated = Number(poolStats?.allocated_mcu_credits ?? 0);
  const totalMcuConsumed = Number(poolStats?.consumed_mcu_credits ?? 0);

  const clientMap = groupCommissionsByClient(commissions);
  const { subscriptionRecords, subClientMetrics } = buildSubClientMetrics(clientMap, now);

  const cohortMatrix = computePartnerCohortMatrix(subscriptionRecords);

  subClientMetrics.sort((a, b) => b.currentMrrCents - a.currentMrrCents);
  const topSubClients = subClientMetrics.slice(0, 10);

  const revenueGrowthPct = calculateRevenueGrowthPct(cohortMatrix.cohorts);
  const { monthlyCommissionCents, totalMrrCents } = calculateCommissionsAndMrr(
    commissions,
    currentPeriod,
    profile?.total_mrr_cents,
  );

  const avgMcuVelocityDaily = subClientMetrics.length > 0
    ? Number((subClientMetrics.reduce((acc, c) => acc + c.mcuVelocityDaily, 0) / subClientMetrics.length).toFixed(1))
    : 0;

  return {
    partnerId,
    partnerName,
    tier,
    period: currentPeriod,
    generatedAt: now,
    totalSubClients: cohortMatrix.summary.totalClients,
    activeSubClients: cohortMatrix.summary.activeClients,
    totalMrrCents,
    monthlyCommissionCents,
    lifetimeEarningsCents: profile?.total_earnings_cents ?? 0,
    totalMcuAllocated,
    totalMcuConsumed,
    avgMcuVelocityDaily,
    avgLtvCents: cohortMatrix.summary.avgLtvCents,
    blendedChurnPct: cohortMatrix.summary.blendedChurnPct,
    revenueGrowthPct,
    topSubClients,
    cohortMatrix,
  };
}
