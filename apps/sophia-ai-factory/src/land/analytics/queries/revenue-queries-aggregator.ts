/**
 * Analytics - Revenue Metrics Period Resolver & Aggregator
 *
 * Pure aggregation helpers for license MRR and payment trend calculation.
 * @module land/analytics/queries/revenue-queries-aggregator
 */

import type { Json } from '@/tree/database/supabase-types';
import type { RevenuePeriod, RevenueMetrics } from '../types';

export type LicenseRevenueRow = { tier: string | null; created_at: number; metadata: Json | null };
export type PaymentEventRow = { event_type: string; payload: Json | null; created_at: string };

type LicenseMetadataShape = { mrr_usd?: number; subscription_amount?: number; is_subscription?: boolean };
type PaymentPayloadShape = { amount?: { usd?: { amount?: number } } };

function narrowJsonObject<T>(val: Json | null | undefined): T {
  return (val && typeof val === 'object' && !Array.isArray(val) ? val : {}) as T;
}

/**
 * Resolve timestamp boundaries for a given revenue period
 */
export function resolvePeriodTimestamps(period: RevenuePeriod): {
  startTimestamp: number;
  endTimestamp: number;
} {
  const now = new Date();
  const endTimestamp = Math.floor(now.getTime() / 1000);
  let startTimestamp: number;

  switch (period) {
    case 'current_month':
      startTimestamp = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
      break;
    case 'last_month':
      startTimestamp = Math.floor(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000);
      return {
        startTimestamp,
        endTimestamp: Math.floor(new Date(now.getFullYear(), now.getMonth(), 0).getTime() / 1000),
      };
    case 'last_7_days':
      startTimestamp = endTimestamp - (7 * 86400);
      break;
    case 'last_30_days':
    default:
      startTimestamp = endTimestamp - (30 * 86400);
  }

  return { startTimestamp, endTimestamp };
}

function aggregatePaymentTrend(
  paymentEvents: PaymentEventRow[] | null | undefined,
): Array<{ date: string; revenue: number }> {
  const revenueByDate = new Map<string, number>();
  for (const event of paymentEvents ?? []) {
    const date = new Date(event.created_at).toISOString().split('T')[0];
    const payload = narrowJsonObject<PaymentPayloadShape>(event.payload);
    const amount = payload.amount?.usd?.amount ?? 0;
    revenueByDate.set(date, (revenueByDate.get(date) || 0) + amount);
  }

  return Array.from(revenueByDate.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregate raw license and payment event rows into RevenueMetrics
 */
export function aggregateRevenueMetrics(
  licenses: LicenseRevenueRow[] | null | undefined,
  paymentEvents: PaymentEventRow[] | null | undefined,
): RevenueMetrics {
  const mrrByTier = new Map<string, { customers: number; revenue: number }>();
  ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'].forEach(tier => {
    mrrByTier.set(tier, { customers: 0, revenue: 0 });
  });

  let totalRevenue = 0;
  let recurringRevenue = 0;
  let oneTimeRevenue = 0;

  for (const license of licenses ?? []) {
    const tier = license.tier || 'BASIC';
    const entry = mrrByTier.get(tier) || { customers: 0, revenue: 0 };
    entry.customers += 1;

    const metadata = narrowJsonObject<LicenseMetadataShape>(license.metadata);
    const mrr = metadata.mrr_usd ?? metadata.subscription_amount ?? 0;

    if (metadata.is_subscription) {
      entry.revenue += mrr;
      recurringRevenue += mrr;
    } else {
      oneTimeRevenue += mrr;
    }

    totalRevenue += mrr;
    mrrByTier.set(tier, entry);
  }

  const byTier = Array.from(mrrByTier.entries())
    .map(([tier, data]) => ({ tier, customers: data.customers, revenue: data.revenue }))
    .filter(t => t.customers > 0 || t.revenue > 0);

  return {
    totalRevenue,
    recurringRevenue,
    oneTimeRevenue,
    byTier,
    trend: aggregatePaymentTrend(paymentEvents),
  };
}
