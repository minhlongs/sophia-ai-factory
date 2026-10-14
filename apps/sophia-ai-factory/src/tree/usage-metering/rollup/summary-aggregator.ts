/**
 * Summary Aggregator
 *
 * Layer: tree/usage-metering
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { aggregateUsageEvents, buildHourlySummary, buildDailySummary } from '../usage-event-collector';
import type { HourlySummary, DailySummary } from '../types';
import type { D1Response } from '@/seed/db/types';
import { MAX_DATE_RANGE_DAYS } from './constants';

/**
 * Get aggregated summary for a tenant by period
 */
export async function getAggregatedSummary(
  tenantId: string,
  startTimestamp: number,
  endTimestamp: number,
  licenseNonce?: string
): Promise<{ hourly: HourlySummary[]; daily: DailySummary[]; totalCredits: number; totalRequests: number }> {
  // Cap date range at 90 days
  const maxRange = MAX_DATE_RANGE_DAYS * 86400;
  let endTs = endTimestamp;
  if (endTs - startTimestamp > maxRange) {
    logger.warn('[Aggregator] Date range exceeds maximum, limiting to 90 days');
    endTs = startTimestamp + maxRange;
  }

  const db = createServerClient();
  let query = db.from('usage_events').select('*').eq('user_id', tenantId).gte('created_at', startTimestamp).lte('created_at', endTs);

  if (licenseNonce) {
    query = query.eq('license_nonce', licenseNonce);
  }

  const { data: events, error } = await query as unknown as D1Response<Record<string, unknown>[]>;

  if (error || !events || events.length === 0) {
    if (error) logger.error('[Aggregator] Failed to fetch events', error instanceof Error ? error : new Error(String(error)));
    return { hourly: [], daily: [], totalCredits: 0, totalRequests: 0 };
  }

  const aggregated = aggregateUsageEvents(events as Array<{
    user_id: string;
    license_nonce: string;
    service_name: string;
    action: string;
    credits_used: number;
    tokens_input: number;
    tokens_output: number;
    response_time_ms: number | null;
    status_code: number | null;
    created_at: number;
  }>, 'hour');
  const hourly = buildHourlySummary(aggregated);
  const daily = buildDailySummary(hourly);

  return {
    hourly,
    daily,
    totalCredits: hourly.reduce((sum, h) => sum + h.totalCredits, 0),
    totalRequests: hourly.reduce((sum, h) => sum + h.totalRequests, 0),
  };
}
