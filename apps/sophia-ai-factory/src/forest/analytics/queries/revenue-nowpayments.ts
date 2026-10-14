/**
 * Revenue query helper — NOWPayments IPN + raas_licenses source.
 *
 * Replaces the old Polar.sh-based revenue-queries.ts for the snapshot endpoint.
 * Uses raas_licenses (active, non-revoked) + TIER_CONFIGS prices as MRR source.
 * NOWPayments payment_events drive 30d trend data.
 */

import { createServerClient } from '@/seed/db/client';
import type { D1QueryChain } from '@/seed/db/d1-query-chain';
import { logger } from '@/seed/utils/logger-utility';
import type { RevenueSnapshot, RevenuePeriod } from '@/seed/types/analytics-revenue';
import {
  resolvePeriodBounds,
  mrrForTier,
  buildTierRows,
  buildTrend,
  type PeriodBounds,
  type LicenseRow,
  type PaymentEventRow,
} from './revenue-nowpayments-helpers';

export {
  resolvePeriodBounds,
  mrrForTier,
  buildTierRows,
  buildTrend,
  type PeriodBounds,
  type LicenseRow,
  type PaymentEventRow,
};

/**
 * Fetch revenue snapshot from NOWPayments IPN events + raas_licenses.
 *
 * @param period  - Time window: '30d' | '90d' | '12m'
 * @param orgId   - Optional created_by user ID filter (admin cross-tenant)
 */
export async function fetchRevenueSnapshot(
  period: RevenuePeriod,
  orgId?: string,
): Promise<RevenueSnapshot> {
  const db = createServerClient();
  const { start, end, priorStart, priorEnd } = resolvePeriodBounds(period);

  // ── Current active licenses ──
  let currentQuery = db
    .from('raas_licenses')
    .select('tier, is_revoked, created_at')
    .eq('is_revoked', false)
    .lte('created_at', end) as unknown as D1QueryChain<LicenseRow>;

  if (orgId) {
    currentQuery = currentQuery.eq('created_by', orgId);
  }

  const { data: currentLicenses, error: currentError } = await currentQuery as {
    data: LicenseRow[] | null;
    error: { message: string } | null;
  };

  if (currentError) {
    logger.error('[Revenue] Failed to fetch current licenses');
    throw new Error('Failed to fetch revenue data');
  }

  // ── Prior-period licenses (for MRR growth comparison) ──
  const { data: priorLicenses } = await db
    .from('raas_licenses')
    .select('tier, is_revoked, created_at')
    .eq('is_revoked', false)
    .gte('created_at', priorStart)
    .lte('created_at', priorEnd) as {
    data: LicenseRow[] | null;
    error: unknown;
  };

  // ── 30d NOWPayments event trend ──
  const thirtyDayStart = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: eventRows } = await db
    .from('payment_events')
    .select('created_at, payload')
    .eq('processed', 1)
    .gte('created_at', thirtyDayStart)
    .lte('created_at', end) as {
    data: PaymentEventRow[] | null;
    error: unknown;
  };

  // ── Build response ──
  const byTier = buildTierRows(currentLicenses ?? []);
  const mrr = byTier.reduce((sum, r) => sum + r.mrr, 0);
  const arr = mrr * 12;

  const priorByTier = buildTierRows(priorLicenses ?? []);
  const priorMrr = priorByTier.reduce((sum, r) => sum + r.mrr, 0);
  const mrrGrowthPct = priorMrr > 0
    ? Math.round(((mrr - priorMrr) / priorMrr) * 10_000) / 100
    : null;

  const trend30d = buildTrend(eventRows ?? []);

  logger.info('[Revenue] Snapshot built');

  return { arr, mrr, mrrGrowthPct, byTier, trend30d, periodStart: start, periodEnd: end };
}
