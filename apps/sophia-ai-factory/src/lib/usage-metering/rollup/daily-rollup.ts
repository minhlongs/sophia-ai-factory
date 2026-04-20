/**
 * Daily Rollup - Aggregate hourly summaries into per-day summaries
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { DailySummaryRecord, ServiceBreakdownItem, HourlySummaryRow } from './rollup-utils';
import { calcAvgResponseTime } from './rollup-utils';

/**
 * Calculate daily rollup from hourly summaries
 *
 * @param dayTimestamp - Unix timestamp of day start (00:00:00 UTC)
 * @returns Array of daily summary records grouped by tenant + license
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

  // Group by tenant + license
  const grouped = new Map<string, {
    tenantId: string;
    licenseNonce: string;
    externalCustomerId: string | null;
    requests: number;
    credits: number;
    tokensInput: number;
    tokensOutput: number;
    errors: number;
    responseTimeSum: number;
    count: number;
    hourlyBreakdown: DailySummaryRecord['hourlyBreakdown'];
    serviceMap: Map<string, {
      requests: number; credits: number;
      tokensInput: number; tokensOutput: number; errors: number;
    }>;
  }>();

  for (const hourly of hourlySummaries) {
    const key = `${hourly.tenant_id}:${hourly.license_nonce}`;
    let group = grouped.get(key);

    if (!group) {
      group = {
        tenantId: hourly.tenant_id,
        licenseNonce: hourly.license_nonce,
        externalCustomerId: hourly.external_customer_id,
        requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0,
        errors: 0, responseTimeSum: 0, count: 0,
        hourlyBreakdown: [],
        serviceMap: new Map(),
      };
      grouped.set(key, group);
    }

    group.requests += hourly.total_requests;
    group.credits += hourly.total_credits;
    group.tokensInput += hourly.total_tokens_input;
    group.tokensOutput += hourly.total_tokens_output;
    group.errors += hourly.total_errors;
    group.responseTimeSum += hourly.avg_response_time_ms * hourly.total_requests;
    group.count += 1;

    group.hourlyBreakdown.push({
      hour: hourly.hour_timestamp,
      requests: hourly.total_requests,
      credits: hourly.total_credits,
      tokensInput: hourly.total_tokens_input,
      tokensOutput: hourly.total_tokens_output,
      errors: hourly.total_errors,
    });

    // Aggregate service breakdown from hourly JSON
    const services = Array.isArray(hourly.service_breakdown)
      ? (hourly.service_breakdown as ServiceBreakdownItem[])
      : [];
    for (const svc of services) {
      let svcStats = group.serviceMap.get(svc.service);
      if (!svcStats) {
        svcStats = { requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0, errors: 0 };
        group.serviceMap.set(svc.service, svcStats);
      }
      svcStats.requests += svc.requests;
      svcStats.credits += svc.credits;
      svcStats.tokensInput += svc.tokens_input;
      svcStats.tokensOutput += svc.tokens_output;
      svcStats.errors += svc.errors;
    }
  }

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
        avg_response_time_ms: 0, // granular data unavailable at daily level
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

/**
 * Insert or update daily summary (idempotent upsert)
 *
 * @param summary - Daily summary record
 */
export async function upsertDailySummary(summary: DailySummaryRecord): Promise<void> {
  const db = createServerClient();

  const insertPayload: Record<string, unknown> = {
    day_timestamp: summary.dayTimestamp,
    tenant_id: summary.tenantId,
    license_nonce: summary.licenseNonce,
    external_customer_id: summary.externalCustomerId,
    total_requests: summary.totalRequests,
    total_credits: summary.totalCredits,
    total_tokens_input: summary.totalTokensInput,
    total_tokens_output: summary.totalTokensOutput,
    total_errors: summary.totalErrors,
    avg_response_time_ms: summary.avgResponseTimeMs,
    hourly_breakdown: summary.hourlyBreakdown,
    service_breakdown: summary.serviceBreakdown,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from('usage_daily_summary')
    .insert(insertPayload);

  if (error) {
    const err = new Error(error.message);
    logger.error('[Rollup Service] Error upserting daily summary', err, {
      dayTimestamp: summary.dayTimestamp,
      tenantId: summary.tenantId,
    });
    throw err;
  }
}

/**
 * Run daily rollup for a specific day
 *
 * @param dayTimestamp - Unix timestamp of day start (defaults to yesterday)
 */
export async function runDailyRollup(dayTimestamp?: number): Promise<{
  processed: number;
  success: boolean;
  error?: string;
}> {
  try {
    const now = Math.floor(Date.now() / 86400000);
    const timestamp = dayTimestamp ?? ((now - 1) * 86400);
    const dayStart = new Date(timestamp * 1000).toISOString();

    logger.info('[Rollup Service] Starting daily rollup', { dayStart });

    const summaries = await calculateDailyRollup(timestamp);
    for (const summary of summaries) {
      await upsertDailySummary(summary);
    }

    logger.info('[Rollup Service] Daily rollup complete', { dayStart, processed: summaries.length });
    return { processed: summaries.length, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Rollup Service] Daily rollup failed', new Error(errorMessage));
    return { processed: 0, success: false };
  }
}
