/**
 * @module tree/agents/ceo-revenue-aggregators
 *
 * Pure period parsing and license revenue aggregation helpers for CEO agent.
 * Layer: tree → imports seed only.
 */

import type { RevenueByTier, RevenueTrendPoint } from './ceo-intent-types';

export type PeriodLabel = 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days';

export function parsePeriodLabel(input: string): PeriodLabel {
  const lc = input.toLowerCase();
  if (/current|this\s+month|tháng này|hiện tại/.test(lc)) return 'current_month';
  if (/last\s+month|tháng trước|tháng trước/.test(lc)) return 'last_month';
  if (/last\s+7|7\s+day|tuần/.test(lc)) return 'last_7_days';
  return 'last_30_days';
}

export function resolveTimestamps(periodLabel: PeriodLabel, now: number) {
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

export interface AggregatedLicenseTotals {
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  byTier: RevenueByTier[];
}

export interface RawLicense {
  tier?: unknown;
  created_at?: unknown;
  metadata?: unknown;
}

export function aggregateLicenseTotals(licenses: RawLicense[]): AggregatedLicenseTotals {
  let totalRevenue = 0;
  let recurringRevenue = 0;
  let oneTimeRevenue = 0;
  const tierMap: Record<string, { customers: number; revenue: number }> = {};

  for (const lic of licenses) {
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

  const byTier: RevenueByTier[] = Object.entries(tierMap).map(([tier, data]) => ({
    tier,
    ...data,
  }));

  return { totalRevenue, recurringRevenue, oneTimeRevenue, byTier };
}

export function buildTrendPoints(
  licenses: RawLicense[],
  startTimestamp: number,
  endTimestamp: number,
): RevenueTrendPoint[] {
  const trend: RevenueTrendPoint[] = [];
  const daysDiff = Math.ceil((endTimestamp - startTimestamp) / 86400);
  const bucketSize = daysDiff <= 7 ? 1 : daysDiff <= 31 ? 7 : 30;

  for (let i = 0; i < daysDiff; i += bucketSize) {
    const bucketStart = startTimestamp + i * 86400;
    const bucketEnd = Math.min(bucketStart + bucketSize * 86400, endTimestamp);

    let bucketRevenue = 0;
    for (const lic of licenses) {
      const createdAt = Number(lic.created_at);
      if (createdAt >= bucketStart && createdAt < bucketEnd) {
        bucketRevenue += Number((lic.metadata as Record<string, unknown>)?.amount ?? 0);
      }
    }

    const dateStr = new Date(bucketStart * 1000).toISOString().split('T')[0]!;
    trend.push({ date: dateStr, revenue: bucketRevenue });
  }

  return trend;
}
