/**
 * Hourly Rollup Calculator - Aggregate raw usage events into per-hour summaries
 * Uses SQL GROUP BY to replace JS rollup for performance.
 *
 * Layer: tree/usage-metering/rollup
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { HourlySummaryRecord, ServiceBreakdownItem } from './rollup-utils';
import { calcAvgResponseTime } from './rollup-utils';

interface HourlyGroupRow {
  user_id: string;
  license_nonce: string;
  external_customer_id: string | null;
  service_name: string;
  total_requests: number;
  total_credits: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_errors: number;
  avg_response_time_ms: number | null;
}

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

  // Group by tenant + license to build final summaries with service breakdown
  const summaryMap = new Map<string, {
    tenantId: string;
    licenseNonce: string;
    externalCustomerId: string | null;
    requests: number;
    credits: number;
    tokensInput: number;
    tokensOutput: number;
    errors: number;
    responseTimeSum: number;
    serviceMap: Map<string, {
      requests: number; credits: number;
      tokensInput: number; tokensOutput: number;
      errors: number; responseTimeSum: number;
    }>;
  }>();

  for (const row of groupedRows) {
    const key = `${row.user_id}:${row.license_nonce}`;
    let group = summaryMap.get(key);

    if (!group) {
      group = {
        tenantId: row.user_id,
        licenseNonce: row.license_nonce,
        externalCustomerId: row.external_customer_id,
        requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0,
        errors: 0, responseTimeSum: 0,
        serviceMap: new Map(),
      };
      summaryMap.set(key, group);
    }

    group.requests += row.total_requests;
    group.credits += row.total_credits;
    group.tokensInput += row.total_tokens_input;
    group.tokensOutput += row.total_tokens_output;
    group.errors += row.total_errors;
    if (row.avg_response_time_ms !== null) {
      group.responseTimeSum += row.avg_response_time_ms * row.total_requests;
    }

    // Per-service aggregation
    let svc = group.serviceMap.get(row.service_name);
    if (!svc) {
      svc = { requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0, errors: 0, responseTimeSum: 0 };
      group.serviceMap.set(row.service_name, svc);
    }
    svc.requests += row.total_requests;
    svc.credits += row.total_credits;
    svc.tokensInput += row.total_tokens_input;
    svc.tokensOutput += row.total_tokens_output;
    svc.errors += row.total_errors;
    if (row.avg_response_time_ms !== null) {
      svc.responseTimeSum += row.avg_response_time_ms * row.total_requests;
    }
  }

  // Convert map to array of summaries
  const results: HourlySummaryRecord[] = [];

  for (const [, group] of summaryMap.entries()) {
    const serviceBreakdown: ServiceBreakdownItem[] = Array.from(group.serviceMap.entries()).map(
      ([serviceName, stats]) => ({
        service: serviceName,
        requests: stats.requests,
        credits: stats.credits,
        tokens_input: stats.tokensInput,
        tokens_output: stats.tokensOutput,
        errors: stats.errors,
        avg_response_time_ms: calcAvgResponseTime(stats.responseTimeSum, stats.requests),
      })
    );

    results.push({
      hourTimestamp,
      tenantId: group.tenantId,
      licenseNonce: group.licenseNonce,
      externalCustomerId: group.externalCustomerId,
      totalRequests: group.requests,
      totalCredits: group.credits,
      totalTokensInput: group.tokensInput,
      totalTokensOutput: group.tokensOutput,
      totalErrors: group.errors,
      avgResponseTimeMs: calcAvgResponseTime(group.responseTimeSum, group.requests),
      serviceBreakdown,
    });
  }

  logger.info('[Rollup Service] Calculated hourly rollup', {
    hourTimestamp,
    tenantCount: results.length,
    eventGroups: groupedRows.length,
  });

  return results;
}
