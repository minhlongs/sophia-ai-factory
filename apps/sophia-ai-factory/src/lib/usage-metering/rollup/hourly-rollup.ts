/**
 * Hourly Rollup - Aggregate raw usage events into per-hour summaries
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { getErrorMessage } from '@/lib/utils/to-error';
import type { HourlySummaryRecord, ServiceBreakdownItem, UsageEventRow } from './rollup-utils';
import { calcAvgResponseTime } from './rollup-utils';

/**
 * Calculate hourly rollup from raw usage events
 *
 * @param hourTimestamp - Unix timestamp of hour start
 * @returns Array of hourly summary records grouped by tenant + license
 */
export async function calculateHourlyRollup(hourTimestamp: number): Promise<HourlySummaryRecord[]> {
  const db = createServerClient();
  const hourStart = hourTimestamp;
  const hourEnd = hourTimestamp + 3600;

  const { data: events, error } = await db
    .from('usage_events')
    .select(`
      user_id, license_nonce, external_customer_id,
      service_name, credits_used, tokens_input, tokens_output,
      status_code, response_time_ms
    `)
    .gte('created_at', hourStart)
    .lt('created_at', hourEnd) as unknown as { data: UsageEventRow[] | null; error: unknown };

  if (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Rollup Service] Error fetching events for hourly rollup', err);
    throw err;
  }

  if (!events || events.length === 0) {
    logger.info('[Rollup Service] No events to aggregate for hour', { hourTimestamp });
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
    serviceMap: Map<string, {
      requests: number; credits: number;
      tokensInput: number; tokensOutput: number;
      errors: number; responseTimeSum: number;
    }>;
  }>();

  for (const event of events) {
    const key = `${event.user_id}:${event.license_nonce}`;
    let group = grouped.get(key);

    if (!group) {
      group = {
        tenantId: event.user_id,
        licenseNonce: event.license_nonce,
        externalCustomerId: event.external_customer_id || null,
        requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0,
        errors: 0, responseTimeSum: 0,
        serviceMap: new Map(),
      };
      grouped.set(key, group);
    }

    group.requests += 1;
    group.credits += event.credits_used || 0;
    group.tokensInput += event.tokens_input || 0;
    group.tokensOutput += event.tokens_output || 0;
    if (event.status_code && event.status_code >= 400) group.errors += 1;
    if (event.response_time_ms) group.responseTimeSum += event.response_time_ms;

    // Per-service aggregation
    let svc = group.serviceMap.get(event.service_name);
    if (!svc) {
      svc = { requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0, errors: 0, responseTimeSum: 0 };
      group.serviceMap.set(event.service_name, svc);
    }
    svc.requests += 1;
    svc.credits += event.credits_used || 0;
    svc.tokensInput += event.tokens_input || 0;
    svc.tokensOutput += event.tokens_output || 0;
    if (event.status_code && event.status_code >= 400) svc.errors += 1;
    if (event.response_time_ms) svc.responseTimeSum += event.response_time_ms;
  }

  // Convert grouped map to summary records
  const results: HourlySummaryRecord[] = [];

  for (const [, group] of grouped.entries()) {
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
    totalEvents: events.length,
  });

  return results;
}

/**
 * Insert or update hourly summary (idempotent upsert)
 *
 * @param summary - Hourly summary record
 */
export async function upsertHourlySummary(summary: HourlySummaryRecord): Promise<void> {
  const db = createServerClient();

  const insertPayload: Record<string, unknown> = {
    hour_timestamp: summary.hourTimestamp,
    tenant_id: summary.tenantId,
    license_nonce: summary.licenseNonce,
    external_customer_id: summary.externalCustomerId,
    total_requests: summary.totalRequests,
    total_credits: summary.totalCredits,
    total_tokens_input: summary.totalTokensInput,
    total_tokens_output: summary.totalTokensOutput,
    total_errors: summary.totalErrors,
    avg_response_time_ms: summary.avgResponseTimeMs,
    service_breakdown: summary.serviceBreakdown,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from('usage_hourly_summary')
    .insert(insertPayload);

  if (error) {
    const err = new Error(error.message);
    logger.error('[Rollup Service] Error upserting hourly summary', err, {
      hourTimestamp: summary.hourTimestamp,
      tenantId: summary.tenantId,
    });
    throw err;
  }
}

/**
 * Run hourly rollup for a specific hour
 *
 * @param hourTimestamp - Unix timestamp of hour start (defaults to previous hour)
 */
export async function runHourlyRollup(hourTimestamp?: number): Promise<{
  processed: number;
  success: boolean;
  error?: string;
}> {
  try {
    const timestamp = hourTimestamp ?? (Math.floor(Date.now() / 3600000) - 1) * 3600;
    const hourStart = new Date(timestamp * 1000).toISOString();

    logger.info('[Rollup Service] Starting hourly rollup', { hourStart });

    const summaries = await calculateHourlyRollup(timestamp);
    for (const summary of summaries) {
      await upsertHourlySummary(summary);
    }

    logger.info('[Rollup Service] Hourly rollup complete', { hourStart, processed: summaries.length });
    return { processed: summaries.length, success: true };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('[Rollup Service] Hourly rollup failed', new Error(errorMessage));
    return { processed: 0, success: false };
  }
}
