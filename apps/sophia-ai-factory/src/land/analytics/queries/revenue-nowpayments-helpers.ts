import { TIER_CONFIGS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';
import type { TierRevenueRow, ARRTrendPoint, RevenuePeriod } from '@/seed/types/analytics-revenue';

export interface PeriodBounds {
  start: string;
  end: string;
  priorStart: string;
  priorEnd: string;
}

export function resolvePeriodBounds(period: RevenuePeriod): PeriodBounds {
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

export interface LicenseRow {
  tier: string;
  is_revoked: boolean | number;
  created_at: string | number;
}

export interface PaymentEventRow {
  created_at: string;
  payload: string;
}

export function mrrForTier(tier: Tier): number {
  return TIER_CONFIGS[tier]?.price ?? 0;
}

export function buildTierRows(licenses: LicenseRow[]): TierRevenueRow[] {
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

export function buildTrend(events: PaymentEventRow[]): ARRTrendPoint[] {
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
