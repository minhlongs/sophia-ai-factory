/**
 * @module tree/agents/ceo-revenue-data
 *
 * Revenue insights data fetch for CEO agent.
 * Extracted from ceo-executor.ts for file size management.
 *
 * Layer: tree → imports seed only.
 */

import { createServerClient } from '@/seed/db/client';
import { createLogger } from '@/seed/utils/logger-utility';
import type { RevenueInsights, RevenueByTier, RevenueTrendPoint } from './ceo-intent-types';

const log = createLogger('ceo-executor');

// ── Time period helpers ───────────────────────────────────────────────────────

type PeriodLabel = 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days';

function parsePeriodLabel(input: string): PeriodLabel {
  const lc = input.toLowerCase();
  if (/current|this\s+month|tháng này|hiện tại/.test(lc)) return 'current_month';
  if (/last\s+month|tháng trước|tháng trước/.test(lc)) return 'last_month';
  if (/last\s+7|7\s+day|tuần/.test(lc)) return 'last_7_days';
  return 'last_30_days';
}

function resolveTimestamps(periodLabel: PeriodLabel, now: number) {
  const endTimestamp = Math.floor(now / 1000);
  const d = new Date();

  switch (periodLabel) {
    case 'current_month':
      return {
        startTimestamp: Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000),
        endTimestamp,
      };
    case 'last_month':
      return {
        startTimestamp: Math.floor(new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime() / 1000),
        endTimestamp: Math.floor(new Date(d.getFullYear(), d.getMonth(), 0).getTime() / 1000),
      };
    case 'last_7_days':
      return { startTimestamp: endTimestamp - 7 * 86400, endTimestamp };
    case 'last_30_days':
    default:
      return { startTimestamp: endTimestamp - 30 * 86400, endTimestamp };
  }
}

// ── Revenue fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch revenue insights for a time period.
 *
 * Aggregates license revenue from raas_licenses and payment_events tables.
 * Returns bilingual-friendly data suitable for CEO agent responses.
 */
export async function fetchRevenue(
  periodLabel: string,
  _userId?: string,
): Promise<RevenueInsights> {
  const db = createServerClient();
  const now = Date.now();
  const period = parsePeriodLabel(periodLabel);
  const { startTimestamp, endTimestamp } = resolveTimestamps(period, now);

  // Fetch licenses relevant to this user's org
  const { data: licenses } = await db
    .from('raas_licenses')
    .select('tier, created_at, metadata')
    .gte('created_at', startTimestamp)
    .lte('created_at', endTimestamp);

  let totalRevenue = 0;
  let recurringRevenue = 0;
  let oneTimeRevenue = 0;
  const tierMap: Record<string, { customers: number; revenue: number }> = {};

  for (const lic of licenses ?? []) {
    const tier = (lic.tier as string) ?? 'unknown';
    const amount = Number((lic.metadata as Record<string, unknown>)?.amount ?? 0);
    const isRecurring = Boolean((lic.metadata as Record<string, unknown>)?.recurring);

    totalRevenue += amount;
    if (isRecurring) recurringRevenue += amount;
    else oneTimeRevenue += amount;

    if (!tierMap[tier]) tierMap[tier] = { customers: 0, revenue: 0 };
    tierMap[tier].customers += 1;
    tierMap[tier].revenue += amount;
  }

  // Build tier breakdown
  const byTier: RevenueByTier[] = Object.entries(tierMap).map(([tier, data]) => ({
    tier,
    ...data,
  }));

  // Build trend data (simplified: daily totals)
  const trend: RevenueTrendPoint[] = [];
  const daysDiff = Math.ceil((endTimestamp - startTimestamp) / 86400);
  const bucketSize = daysDiff <= 7 ? 1 : daysDiff <= 31 ? 7 : 30;

  for (let i = 0; i < daysDiff; i += bucketSize) {
    const bucketStart = startTimestamp + i * 86400;
    const bucketEnd = Math.min(bucketStart + bucketSize * 86400, endTimestamp);

    let bucketRevenue = 0;
    for (const lic of licenses ?? []) {
      const createdAt = Number(lic.created_at);
      if (createdAt >= bucketStart && createdAt < bucketEnd) {
        bucketRevenue += Number((lic.metadata as Record<string, unknown>)?.amount ?? 0);
      }
    }

    const dateStr = new Date(bucketStart * 1000).toISOString().split('T')[0]!;
    trend.push({ date: dateStr, revenue: bucketRevenue });
  }

  log.info('[ceo-executor] Revenue fetched', {
    period,
    totalRevenue,
    licensesCount: (licenses ?? []).length,
  });

  return {
    periodLabel,
    totalRevenue,
    recurringRevenue,
    oneTimeRevenue,
    byTier,
    trend,
  };
}
