/**
 * Analytics - Usage Metrics Aggregator
 *
 * Pure aggregation helpers for usage event rollups (time-series & service breakdown).
 */

import type { UsageMetrics } from '../types';

export interface UsageEventProjection {
  created_at: number;
  credits_used: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  status_code: number | null;
  service_name: string | null;
  response_time_ms: number | null;
}

export function createEmptyUsageMetrics(): UsageMetrics {
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

export function aggregateUsageEvents(
  events: UsageEventProjection[],
  granularity: 'hour' | 'day' = 'hour'
): UsageMetrics {
  const timeSeriesMap = new Map<
    number,
    { requests: number; credits: number; tokens: number; errors: number }
  >();
  const serviceMap = new Map<string, { requests: number; credits: number }>();

  let totalRequests = 0;
  let totalCredits = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  let totalErrors = 0;
  let totalResponseTime = 0;
  let responseTimeCount = 0;

  for (const event of events) {
    const timestamp =
      granularity === 'hour'
        ? Math.floor(event.created_at / 3600) * 3600
        : Math.floor(event.created_at / 86400) * 86400;

    const tsEntry = timeSeriesMap.get(timestamp) || {
      requests: 0,
      credits: 0,
      tokens: 0,
      errors: 0,
    };
    tsEntry.requests += 1;
    tsEntry.credits += event.credits_used || 0;
    tsEntry.tokens += (event.tokens_input || 0) + (event.tokens_output || 0);
    if (!event.status_code || event.status_code >= 400) tsEntry.errors += 1;
    timeSeriesMap.set(timestamp, tsEntry);

    const serviceName = event.service_name || 'unknown';
    const serviceEntry = serviceMap.get(serviceName) || { requests: 0, credits: 0 };
    serviceEntry.requests += 1;
    serviceEntry.credits += event.credits_used || 0;
    serviceMap.set(serviceName, serviceEntry);

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

  const timeSeries = Array.from(timeSeriesMap.entries())
    .map(([timestamp, data]) => ({
      timestamp,
      requests: data.requests,
      credits: data.credits,
      tokens: data.tokens,
      errors: data.errors,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

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
      avgResponseTimeMs:
        responseTimeCount > 0
          ? Math.round((totalResponseTime / responseTimeCount) * 100) / 100
          : 0,
      errorRate:
        totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 10000) / 100 : 0,
    },
    timeSeries,
    serviceBreakdown,
  };
}
