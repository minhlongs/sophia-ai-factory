/**
 * Daily Rollup Calculator — aggregates hourly summaries into daily records
 * Upsert + runner live in daily-rollup.ts
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { DailySummaryRecord, ServiceBreakdownItem, HourlySummaryRow } from './rollup-utils';
import { calcAvgResponseTime } from './rollup-utils';
import { groupHourlySummaries } from './daily-rollup-grouper';

/**
 * Calculate daily rollup from hourly summaries
 *
 * @param dayTimestamp - Unix timestamp of day start (00:00:00 UTC)
 */
export async function calculateDailyRollup(dayTimestamp: number): Promise<DailySummaryRecord[]> {
  const db = createServerClient();

  const { data: hourlySummaries, error } = await db
    .from('usage_hourly_summary')
    .select(`
      hour_timestamp, tenant_id, license_nonce, external_customer_id,
      total_requests, total_credits, total_tokens_input, total_tokens_output,
      total_errors, avg_response_time_ms, service_breakdown
    `) as unknown as { data: HourlySummaryRow[] | null; error: unknown };

  if (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Rollup Service] Error fetching hourly summaries for daily rollup', err);
    throw err;
  }

  if (!hourlySummaries || hourlySummaries.length === 0) {
    logger.info('[Rollup Service] No hourly summaries to aggregate for day', { dayTimestamp });
    return [];
  }

  const grouped = groupHourlySummaries(hourlySummaries);
  const results: DailySummaryRecord[] = [];

  for (const [, group] of grouped.entries()) {
    const serviceBreakdown: ServiceBreakdownItem[] = Array.from(group.serviceMap.entries()).map(
      ([serviceName, stats]) => ({
        service: serviceName,
        requests: stats.requests,
        credits: stats.credits,
        tokens_input: stats.tokensInput,
        tokens_output: stats.tokensOutput,
        errors: stats.errors,
        avg_response_time_ms: 0,
      })
    );

    results.push({
      dayTimestamp,
      tenantId: group.tenantId,
      licenseNonce: group.licenseNonce,
      externalCustomerId: group.externalCustomerId,
      totalRequests: group.requests,
      totalCredits: group.credits,
      totalTokensInput: group.tokensInput,
      totalTokensOutput: group.tokensOutput,
      totalErrors: group.errors,
      avgResponseTimeMs: calcAvgResponseTime(group.responseTimeSum, group.requests),
      hourlyBreakdown: group.hourlyBreakdown,
      serviceBreakdown,
    });
  }

  logger.info('[Rollup Service] Calculated daily rollup', {
    dayTimestamp,
    tenantCount: results.length,
    hourlySummariesCount: hourlySummaries.length,
  });

  return results;
}
