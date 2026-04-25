/**
 * Revenue query helper — NOWPayments IPN + raas_licenses source.
 *
 * Replaces the old Polar.sh-based revenue-queries.ts for the snapshot endpoint.
 * Uses raas_licenses (active, non-revoked) + TIER_CONFIGS prices as MRR source.
 * NOWPayments payment_events drive 30d trend data.
 */

import { createServerClient } from '@/lib/db/client';
import { TIER_CONFIGS } from '@/config/tiers';
import { logger } from '@/lib/utils/logger-utility';
import type { Tier } from '@/types';
import type { RevenueSnapshot, TierRevenueRow, ARRTrendPoint, RevenuePeriod } from '@/types/analytics-revenue';

// ── Period helpers ──────────────────────────────────────────────────────────

interface PeriodBounds {
  start: string;
  end: string;
  priorStart: string;
  priorEnd: string;
}

function resolvePeriodBounds(period: RevenuePeriod): PeriodBounds {
  const now = new Date();
  const end = now.toISOString();
  let windowMs: number;

  switch (period) {
    case '90d':  windowMs = 90 * 86_400_000; break;
    case '12m':  windowMs = 365 * 86_400_000; break;
    case '30d':
    default:     windowMs = 30 * 86_400_000;
  }

  const startMs = now.getTime() - windowMs;
  const start = new Date(startMs).toISOString();
  const priorEnd = start;
  const priorStart = new Date(startMs - 30 * 86_400_000).toISOString();

  return { start, end, priorStart, priorEnd };
}

// ── D1 row types ────────────────────────────────────────────────────────────

interface LicenseRow {
  tier: string;
  is_revoked: boolean | number;
  created_at: string | number;
}

interface PaymentEventRow {
  created_at: string;
  payload: string;
}

// ── MRR from license rows ───────────────────────────────────────────────────

function mrrForTier(tier: Tier): number {
  return TIER_CONFIGS[tier]?.price ?? 0;
}

function buildTierRows(licenses: LicenseRow[]): TierRevenueRow[] {
  const tiers: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
  const countMap = new Map<Tier, number>();
  tiers.forEach(t => countMap.set(t, 0));

  for (const lic of licenses) {
    const normalized = lic.tier?.toUpperCase() as Tier;
    if (countMap.has(normalized)) {
      countMap.set(normalized, (countMap.get(normalized) ?? 0) + 1);
    }
  }

  return tiers.map(tier => {
    const customers = countMap.get(tier) ?? 0;
    const mrr = mrrForTier(tier) * customers;
    return { tier, customers, mrr, arr: mrr * 12 };
  }).filter(r => r.customers > 0);
}

// ── Trend from payment_events ───────────────────────────────────────────────

function buildTrend(events: PaymentEventRow[]): ARRTrendPoint[] {
  const dayMap = new Map<string, number>();

  for (const event of events) {
    const day = event.created_at.slice(0, 10); // YYYY-MM-DD
    let amount = 0;
    try {
      const parsed = JSON.parse(event.payload) as Record<string, unknown>;
      const payAmount = parsed['pay_amount'];
      if (typeof payAmount === 'number') amount = payAmount;
      else if (typeof payAmount === 'string') amount = parseFloat(payAmount) || 0;
    } catch { /* invalid payload — skip */ }
    dayMap.set(day, (dayMap.get(day) ?? 0) + amount);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, mrr]) => ({ date, mrr, arr: mrr * 12 }));
}

// ── Public API ──────────────────────────────────────────────────────────────

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentQuery: any = db
    .from('raas_licenses')
    .select('tier, is_revoked, created_at')
    .eq('is_revoked', false)
    .lte('created_at', end);

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
