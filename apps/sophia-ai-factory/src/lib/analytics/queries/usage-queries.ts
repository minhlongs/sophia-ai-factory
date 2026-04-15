/**
 * Analytics - Usage Metrics Queries
 *
 * Fetches usage events and builds time-series / service breakdown metrics
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { UsageFilters, UsageMetrics } from '../types';

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
    .from('usage_events')
    .select('*')
    .gte('created_at', filters.startTimestamp)
    .lte('created_at', filters.endTimestamp);

  if (filters.licenseNonce) {
    query = query.eq('license_nonce', filters.licenseNonce);
  }

  if (filters.service) {
    query = query.eq('service_name', filters.service);
  }

  const { data: events, error } = await query as any;

  if (error) {
    logger.error('[Analytics] Failed to fetch usage events', error);
    throw new Error('Failed to fetch usage data');
  }

  if (!events || events.length === 0) {
    return {
      summary: {
        totalRequests: 0,
        totalTokensInput: 0,
        totalTokensOutput: 0,
        totalCredits: 0,
        avgResponseTimeMs: 0,
        errorRate: 0,
      },
      timeSeries: [],
      serviceBreakdown: [],
    };
  }

  // Build time-series data
  const granularity = filters.granularity || 'hour';
  const timeSeriesMap = new Map<number, {
    requests: number;
    credits: number;
    tokens: number;
    errors: number;
  }>();

  // Build service breakdown
  const serviceMap = new Map<string, {
    requests: number;
    credits: number;
  }>();

  // Calculate totals
  let totalRequests = 0;
  let totalCredits = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  let totalErrors = 0;
  let totalResponseTime = 0;
  let responseTimeCount = 0;

  for (const event of events) {
    // Calculate time bucket
    const timestamp = granularity === 'hour'
      ? Math.floor(event.created_at / 3600) * 3600
      : Math.floor(event.created_at / 86400) * 86400;

    // Update time-series
    const tsEntry = timeSeriesMap.get(timestamp) || {
      requests: 0, credits: 0, tokens: 0, errors: 0,
    };
    tsEntry.requests += 1;
    tsEntry.credits += event.credits_used || 0;
    tsEntry.tokens += (event.tokens_input || 0) + (event.tokens_output || 0);
    if (!event.status_code || event.status_code >= 400) tsEntry.errors += 1;
    timeSeriesMap.set(timestamp, tsEntry);

    // Update service breakdown
    const serviceName = event.service_name || 'unknown';
    const serviceEntry = serviceMap.get(serviceName) || { requests: 0, credits: 0 };
    serviceEntry.requests += 1;
    serviceEntry.credits += event.credits_used || 0;
    serviceMap.set(serviceName, serviceEntry);

    // Update totals
    totalRequests += 1;
    totalCredits += event.credits_used || 0;
    totalTokensInput += event.tokens_input || 0;
    totalTokensOutput += event.tokens_output || 0;
    if (!event.status_code || event.status_code >= 400) totalErrors += 1;
    if (event.response_time_ms) {
      totalResponseTime += event.response_time_ms;
      responseTimeCount += 1;
    }
  }

  // Build time-series array
  const timeSeries = Array.from(timeSeriesMap.entries())
    .map(([timestamp, data]) => ({
      timestamp,
      requests: data.requests,
      credits: data.credits,
      tokens: data.tokens,
      errors: data.errors,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Build service breakdown with percentages
  const serviceBreakdown = Array.from(serviceMap.entries())
    .map(([service, data]) => ({
      service,
      requests: data.requests,
      credits: data.credits,
      percentage: totalRequests > 0 ? (data.requests / totalRequests) * 100 : 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  return {
    summary: {
      totalRequests,
      totalTokensInput,
      totalTokensOutput,
      totalCredits,
      avgResponseTimeMs: responseTimeCount > 0
        ? Math.round((totalResponseTime / responseTimeCount) * 100) / 100
        : 0,
      errorRate: totalRequests > 0
        ? Math.round((totalErrors / totalRequests) * 10000) / 100
        : 0,
    },
    timeSeries,
    serviceBreakdown,
  };
}
