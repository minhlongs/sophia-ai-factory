/**
 * Analytics - Usage Metrics Queries
 *
 * Fetches usage events and builds time-series / service breakdown metrics
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { UsageFilters, UsageMetrics } from '../types';
import {
  aggregateUsageEvents,
  createEmptyUsageMetrics,
  type UsageEventProjection,
} from './usage-aggregator';

/** Maximum date range for queries (90 days) */
const MAX_DATE_RANGE_DAYS = 90;

/**
 * Fetch usage metrics from Supabase
 *
 * @param filters - Query filters for usage data
 */
export async function fetchUsageMetrics(filters: UsageFilters): Promise<UsageMetrics> {
  const db = createServerClient();

  // Validate date range
  const dateRangeDays = (filters.endTimestamp - filters.startTimestamp) / 86400;
  if (dateRangeDays > MAX_DATE_RANGE_DAYS) {
    throw new Error(`Date range exceeds maximum of ${MAX_DATE_RANGE_DAYS} days`);
  }

  let query = db
    .from<UsageEventProjection>('usage_events')
    .select('*')
    .gte('created_at', filters.startTimestamp)
    .lte('created_at', filters.endTimestamp);

  if (filters.licenseNonce) {
    query = query.eq('license_nonce', filters.licenseNonce);
  }

  if (filters.service) {
    query = query.eq('service_name', filters.service);
  }

  const { data: events, error } = await query;

  if (error) {
    // Plain object preserves `.code` for downstream alert filtering — mirrors
    // revenue-queries fix (commit 4023b51f) where `error` typed as QueryError
    // lacks the index signature logger.error expects.
    logger.error('[Analytics] Failed to fetch usage events', {
      message: error.message,
      code: error.code,
    });
    throw new Error('Failed to fetch usage data');
  }

  if (!events || events.length === 0) {
    return createEmptyUsageMetrics();
  }

  return aggregateUsageEvents(events, filters.granularity || 'hour');
}
