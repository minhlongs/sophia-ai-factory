/**
 * Hourly Rollup Calculator - Aggregate raw usage events into per-hour summaries
 * Uses SQL GROUP BY to replace JS rollup for performance.
 *
 * Layer: tree/usage-metering/rollup
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { HourlySummaryRecord } from './rollup-utils';
import {
  type HourlyGroupRow,
  buildHourlySummariesFromRows,
} from './hourly-rollup-grouper';

/**
 * Calculate hourly rollup from raw usage events using SQL aggregation
 *
 * @param hourTimestamp - Unix timestamp of hour start
 * @returns Array of hourly summary records grouped by tenant + license
 */
export async function calculateHourlyRollup(hourTimestamp: number): Promise<HourlySummaryRecord[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const hourStart = hourTimestamp;
  const hourEnd = hourTimestamp + 3600;

  // SQL GROUP BY replaces in-memory rollup: aggregates per tenant+license+service in a single query
  const { data: groupedRows, error } = await db
    .prepare(`
      SELECT
        user_id,
        license_nonce,
        external_customer_id,
        service_name,
        COUNT(*) as total_requests,
        SUM(credits_used) as total_credits,
        SUM(tokens_input) as total_tokens_input,
        SUM(tokens_output) as total_tokens_output,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as total_errors,
        AVG(response_time_ms) as avg_response_time_ms
      FROM usage_events
      WHERE created_at >= ? AND created_at < ?
      GROUP BY user_id, license_nonce, external_customer_id, service_name
    `)
    .bind(hourStart, hourEnd)
    .all<HourlyGroupRow>() as unknown as { data: HourlyGroupRow[] | null; error: unknown };

  if (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Rollup Service] Error fetching events for hourly rollup', err);
    throw err;
  }

  if (!groupedRows || groupedRows.length === 0) {
    logger.info('[Rollup Service] No events to aggregate for hour', { hourTimestamp });
    return [];
  }

  const results = buildHourlySummariesFromRows(groupedRows, hourTimestamp);

  logger.info('[Rollup Service] Calculated hourly rollup', {
    hourTimestamp,
    tenantCount: results.length,
    eventGroups: groupedRows.length,
  });

  return results;
}
