/**
 * Analytics - Revenue Metrics Queries
 *
 * Fetches license and payment data to build MRR / revenue breakdown metrics
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { RevenuePeriod, RevenueMetrics } from '../types';
import {
  resolvePeriodTimestamps,
  aggregateRevenueMetrics,
  type LicenseRevenueRow,
  type PaymentEventRow,
} from './revenue-queries-aggregator';

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
    .from<LicenseRevenueRow>('raas_licenses')
    .select('tier, created_at, metadata')
    .gte('created_at', startTimestamp)
    .lte('created_at', endTimestamp);

  if (error) {
    // Plain object preserves `.code` for downstream alert filtering — mirrors
    // the violations-get-handler fix (commit 417330a4) where wrapping in
    // `new Error(msg)` silently dropped the QueryError discriminator.
    logger.error('[Analytics] Failed to fetch licenses for revenue', { message: error.message, code: error.code });
    throw new Error('Failed to fetch revenue data');
  }

  // Query payment_events for revenue trend
  const { data: paymentEvents } = await db
    .from<PaymentEventRow>('payment_events')
    .select('event_type, payload, created_at')
    .gte('created_at', new Date(startTimestamp * 1000).toISOString())
    .lte('created_at', new Date(endTimestamp * 1000).toISOString())
    .eq('processed', true);

  return aggregateRevenueMetrics(licenses, paymentEvents);
}
