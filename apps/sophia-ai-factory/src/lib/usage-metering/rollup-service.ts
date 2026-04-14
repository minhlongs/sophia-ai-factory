/**
 * Usage Metering - Rollup Service
 *
 * Hourly and daily rollup aggregation for usage metrics
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { Json } from '@/lib/supabase/types';

/**
 * Service breakdown item
 */
interface ServiceBreakdownItem {
  service: string;
  requests: number;
  credits: number;
  tokens_input: number;
  tokens_output: number;
  errors: number;
  avg_response_time_ms: number;
}

/**
 * Hourly summary record
 */
interface HourlySummaryRecord {
  hourTimestamp: number;
  tenantId: string;
  licenseNonce: string;
  externalCustomerId: string | null;
  totalRequests: number;
  totalCredits: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalErrors: number;
  avgResponseTimeMs: number;
  serviceBreakdown: ServiceBreakdownItem[];
}

/**
 * Calculate hourly rollup from raw usage events
 *
 * @param hourTimestamp - Unix timestamp of hour start
 * @returns Array of hourly summary records
 */
export async function calculateHourlyRollup(hourTimestamp: number): Promise<HourlySummaryRecord[]> {
  const db = createServerClient();

  // Calculate hour boundaries
  const hourStart = hourTimestamp;
  const hourEnd = hourTimestamp + 3600; // 1 hour = 3600 seconds

  // Query raw events for this hour
  const { data: events, error } = await db
    .from('usage_events')
    .select(`
      user_id,
      license_nonce,
      external_customer_id,
      service_name,
      credits_used,
      tokens_input,
      tokens_output,
      status_code,
      response_time_ms
    `)
    .gte('created_at', hourStart)
    .lt('created_at', hourEnd) as { data: Array<{
      user_id: string;
      license_nonce: string;
      external_customer_id: string | null;
      service_name: string;
      credits_used: number;
      tokens_input: number;
      tokens_output: number;
      status_code: number | null;
      response_time_ms: number | null;
    }> | null; error: Error | unknown };

  if (error) {
    logger.error('[Rollup Service] Error fetching events for hourly rollup', error);
    throw error;
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
      requests: number;
      credits: number;
      tokensInput: number;
      tokensOutput: number;
      errors: number;
      responseTimeSum: number;
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
        requests: 0,
        credits: 0,
        tokensInput: 0,
        tokensOutput: 0,
        errors: 0,
        responseTimeSum: 0,
        serviceMap: new Map(),
      };
      grouped.set(key, group);
    }

    // Aggregate tenant metrics
    group.requests += 1;
    group.credits += event.credits_used || 0;
    group.tokensInput += event.tokens_input || 0;
    group.tokensOutput += event.tokens_output || 0;

    if (event.status_code && event.status_code >= 400) {
      group.errors += 1;
    }

    if (event.response_time_ms) {
      group.responseTimeSum += event.response_time_ms;
    }

    // Aggregate service metrics
    let serviceStats = group.serviceMap.get(event.service_name);
    if (!serviceStats) {
      serviceStats = {
        requests: 0,
        credits: 0,
        tokensInput: 0,
        tokensOutput: 0,
        errors: 0,
        responseTimeSum: 0,
      };
      group.serviceMap.set(event.service_name, serviceStats);
    }

    serviceStats.requests += 1;
    serviceStats.credits += event.credits_used || 0;
    serviceStats.tokensInput += event.tokens_input || 0;
    serviceStats.tokensOutput += event.tokens_output || 0;

    if (event.status_code && event.status_code >= 400) {
      serviceStats.errors += 1;
    }

    if (event.response_time_ms) {
      serviceStats.responseTimeSum += event.response_time_ms;
    }
  }

  // Convert to summary records
  const results: HourlySummaryRecord[] = [];

  for (const [key, group] of grouped.entries()) {
    const serviceBreakdown: ServiceBreakdownItem[] = [];

    for (const [serviceName, stats] of group.serviceMap.entries()) {
      serviceBreakdown.push({
        service: serviceName,
        requests: stats.requests,
        credits: stats.credits,
        tokens_input: stats.tokensInput,
        tokens_output: stats.tokensOutput,
        errors: stats.errors,
        avg_response_time_ms: stats.requests > 0
          ? Math.round((stats.responseTimeSum / stats.requests) * 100) / 100
          : 0,
      });
    }

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
      avgResponseTimeMs: group.requests > 0
        ? Math.round((group.responseTimeSum / group.requests) * 100) / 100
        : 0,
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
 * Insert or update hourly summary (idempotent)
 *
 * @param summary - Hourly summary record
 */
export async function upsertHourlySummary(summary: HourlySummaryRecord): Promise<void> {
  const db = createServerClient();

  const { error } = await db
    .from('usage_hourly_summary')
    .insert({
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
      service_breakdown: summary.serviceBreakdown as any,
      updated_at: new Date().toISOString(),
    } as any) as any;

  if (error) {
    logger.error('[Rollup Service] Error upserting hourly summary', error, {
      hourTimestamp: summary.hourTimestamp,
      tenantId: summary.tenantId,
    });
    throw error as any;
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
    // Default to previous hour if not specified
    const timestamp = hourTimestamp ?? (Math.floor(Date.now() / 3600000) - 1) * 3600;
    const hourStart = new Date(timestamp * 1000).toISOString();

    logger.info('[Rollup Service] Starting hourly rollup', { hourStart });

    // Calculate rollup
    const summaries = await calculateHourlyRollup(timestamp);

    // Insert summaries
    for (const summary of summaries) {
      await upsertHourlySummary(summary);
    }

    logger.info('[Rollup Service] Hourly rollup complete', {
      hourStart,
      processed: summaries.length,
    });

    return {
      processed: summaries.length,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Rollup Service] Hourly rollup failed', new Error(errorMessage));

    return {
      processed: 0,
      success: false,
    };
  }
}

/**
 * Calculate daily rollup from hourly summaries
 *
 * @param dayTimestamp - Unix timestamp of day start (00:00:00 UTC)
 * @returns Array of daily summary records
 */
export async function calculateDailyRollup(dayTimestamp: number): Promise<Array<{
  dayTimestamp: number;
  tenantId: string;
  licenseNonce: string;
  externalCustomerId: string | null;
  totalRequests: number;
  totalCredits: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalErrors: number;
  avgResponseTimeMs: number;
  hourlyBreakdown: Array<{
    hour: number;
    requests: number;
    credits: number;
    tokensInput: number;
    tokensOutput: number;
    errors: number;
  }>;
  serviceBreakdown: ServiceBreakdownItem[];
}>> {
  const db = createServerClient();

  // Calculate day boundaries
  const dayStart = dayTimestamp;
  // const dayEnd = dayTimestamp + 86400; // 24 hours = 86400 seconds - not used

  // Query hourly summaries for this day
  const { data: hourlySummaries, error } = await db
    .from('usage_hourly_summary')
    .select(`
      hour_timestamp,
      tenant_id,
      license_nonce,
      external_customer_id,
      total_requests,
      total_credits,
      total_tokens_input,
      total_tokens_output,
      total_errors,
      avg_response_time_ms,
      service_breakdown
    `) as { data: Array<{
      hour_timestamp: number;
      tenant_id: string;
      license_nonce: string;
      external_customer_id: string | null;
      total_requests: number;
      total_credits: number;
      total_tokens_input: number;
      total_tokens_output: number;
      total_errors: number;
      avg_response_time_ms: number;
      service_breakdown: Json;
    }> | null; error: Error | unknown };

  if (error) {
    logger.error('[Rollup Service] Error fetching hourly summaries for daily rollup', error);
    throw error;
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
    hourlyBreakdown: Array<{
      hour: number;
      requests: number;
      credits: number;
      tokensInput: number;
      tokensOutput: number;
      errors: number;
    }>;
    serviceMap: Map<string, {
      requests: number;
      credits: number;
      tokensInput: number;
      tokensOutput: number;
      errors: number;
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
        requests: 0,
        credits: 0,
        tokensInput: 0,
        tokensOutput: 0,
        errors: 0,
        responseTimeSum: 0,
        count: 0,
        hourlyBreakdown: [],
        serviceMap: new Map(),
      };
      grouped.set(key, group);
    }

    // Aggregate daily totals
    group.requests += hourly.total_requests;
    group.credits += hourly.total_credits;
    group.tokensInput += hourly.total_tokens_input;
    group.tokensOutput += hourly.total_tokens_output;
    group.errors += hourly.total_errors;
    group.responseTimeSum += hourly.avg_response_time_ms * hourly.total_requests;
    group.count += 1;

    // Add to hourly breakdown
    group.hourlyBreakdown.push({
      hour: hourly.hour_timestamp,
      requests: hourly.total_requests,
      credits: hourly.total_credits,
      tokensInput: hourly.total_tokens_input,
      tokensOutput: hourly.total_tokens_output,
      errors: hourly.total_errors,
    });

    // Aggregate service breakdown
    const serviceBreakdown = (hourly.service_breakdown as unknown as ServiceBreakdownItem[]) || [];
    for (const service of serviceBreakdown) {
      let serviceStats = group.serviceMap.get(service.service);
      if (!serviceStats) {
        serviceStats = { requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0, errors: 0 };
        group.serviceMap.set(service.service, serviceStats);
      }

      serviceStats.requests += service.requests;
      serviceStats.credits += service.credits;
      serviceStats.tokensInput += service.tokens_input;
      serviceStats.tokensOutput += service.tokens_output;
      serviceStats.errors += service.errors;
    }
  }

  // Convert to daily summary records
  const results = [];

  for (const [, group] of grouped.entries()) {
    const serviceBreakdown: ServiceBreakdownItem[] = [];

    for (const [serviceName, stats] of group.serviceMap.entries()) {
      serviceBreakdown.push({
        service: serviceName,
        requests: stats.requests,
        credits: stats.credits,
        tokens_input: stats.tokensInput,
        tokens_output: stats.tokensOutput,
        errors: stats.errors,
        avg_response_time_ms: 0, // Would need more granular data to calculate
      });
    }

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
      avgResponseTimeMs: group.count > 0
        ? Math.round((group.responseTimeSum / group.requests) * 100) / 100
        : 0,
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
 * Insert or update daily summary (idempotent)
 */
export async function upsertDailySummary(summary: ReturnType<typeof calculateDailyRollup> extends Promise<Array<infer T>> ? T : never): Promise<void> {
  const db = createServerClient();

  const { error } = await db
    .from('usage_daily_summary')
    .insert({
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
      hourly_breakdown: summary.hourlyBreakdown as any,
      service_breakdown: summary.serviceBreakdown as any,
      updated_at: new Date().toISOString(),
    } as any) as any;

  if (error) {
    logger.error('[Rollup Service] Error upserting daily summary', error, {
      dayTimestamp: summary.dayTimestamp,
      tenantId: summary.tenantId,
    });
    throw error as any;
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
    // Default to yesterday if not specified
    const now = Math.floor(Date.now() / 86400000);
    const timestamp = dayTimestamp ?? ((now - 1) * 86400);
    const dayStart = new Date(timestamp * 1000).toISOString();

    logger.info('[Rollup Service] Starting daily rollup', { dayStart });

    // Calculate rollup
    const summaries = await calculateDailyRollup(timestamp);

    // Insert summaries
    for (const summary of summaries) {
      await upsertDailySummary(summary);
    }

    logger.info('[Rollup Service] Daily rollup complete', {
      dayStart,
      processed: summaries.length,
    });

    return {
      processed: summaries.length,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Rollup Service] Daily rollup failed', new Error(errorMessage));

    return {
      processed: 0,
      success: false,
    };
  }
}
