/**
 * Analytics - Revenue Metrics Queries
 *
 * Fetches license and payment data to build MRR / revenue breakdown metrics
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { RevenuePeriod, RevenueMetrics } from '../types';

/**
 * Resolve timestamp boundaries for a given revenue period
 */
function resolvePeriodTimestamps(period: RevenuePeriod): {
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

/**
 * Fetch revenue metrics from Supabase
 *
 * @param period - Revenue period filter
 */
export async function fetchRevenueMetrics(period: RevenuePeriod): Promise<RevenueMetrics> {
  const db = createServerClient();
  const { startTimestamp, endTimestamp } = resolvePeriodTimestamps(period);

  // Query raas_licenses table
  const { data: licenses, error } = await db
    .from('raas_licenses')
    .select('tier, created_at, metadata')
    .gte('created_at', startTimestamp)
    .lte('created_at', endTimestamp) as any;

  if (error) {
    logger.error('[Analytics] Failed to fetch licenses for revenue', error);
    throw new Error('Failed to fetch revenue data');
  }

  // Query payment_events for revenue trend
  const { data: paymentEvents } = await db
    .from('payment_events')
    .select('event_type, payload, created_at')
    .gte('created_at', new Date(startTimestamp * 1000).toISOString())
    .lte('created_at', new Date(endTimestamp * 1000).toISOString())
    .eq('processed', true) as any;

  // Calculate MRR from active licenses
  const mrrByTier = new Map<string, { customers: number; revenue: number }>();
  ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'].forEach(tier => {
    mrrByTier.set(tier, { customers: 0, revenue: 0 });
  });

  let totalRevenue = 0;
  let recurringRevenue = 0;
  let oneTimeRevenue = 0;

  if (licenses && licenses.length > 0) {
    for (const license of licenses) {
      const tier = license.tier || 'BASIC';
      const entry = mrrByTier.get(tier) || { customers: 0, revenue: 0 };
      entry.customers += 1;

      const metadata = license.metadata as any;
      const mrr = metadata?.mrr_usd || metadata?.subscription_amount || 0;

      if (metadata?.is_subscription) {
        entry.revenue += mrr;
        recurringRevenue += mrr;
      } else {
        oneTimeRevenue += mrr;
      }

      totalRevenue += mrr;
      mrrByTier.set(tier, entry);
    }
  }

  // Process payment events for trend data
  const revenueByDate = new Map<string, number>();
  if (paymentEvents && paymentEvents.length > 0) {
    for (const event of paymentEvents) {
      const date = new Date(event.created_at).toISOString().split('T')[0];
      const amount = (event.payload as any)?.amount?.usd?.amount || 0;
      revenueByDate.set(date, (revenueByDate.get(date) || 0) + amount);
    }
  }

  // Build trend array
  const trend = Array.from(revenueByDate.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Build byTier array
  const byTier = Array.from(mrrByTier.entries())
    .map(([tier, data]) => ({ tier, customers: data.customers, revenue: data.revenue }))
    .filter(t => t.customers > 0 || t.revenue > 0);

  return { totalRevenue, recurringRevenue, oneTimeRevenue, byTier, trend };
}
