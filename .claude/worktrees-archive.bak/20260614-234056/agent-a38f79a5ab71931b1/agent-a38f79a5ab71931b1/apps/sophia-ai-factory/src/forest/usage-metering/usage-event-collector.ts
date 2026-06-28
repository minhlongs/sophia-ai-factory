/**
 * Usage Event Collector
 *
 * Transforms raw usage events into aggregated summaries.
 * Pure in-memory aggregation — no database I/O.
 *
 * @module usage-metering/usage-event-collector
 */

import type {
  AggregatedUsage,
  HourlySummary,
  DailySummary,
} from './types';

export { generateCsvRows, rowsToCsv } from './usage-csv-generator';

/**
 * Aggregate raw usage events into time-windowed summaries.
 */
export function aggregateUsageEvents(
  events: Array<{
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
  }>,
  windowSize: 'hour' | 'day' = 'hour'
): AggregatedUsage[] {
  const aggregationMap = new Map<string, AggregatedUsage>();

  for (const event of events) {
    const timestamp = windowSize === 'hour'
      ? Math.floor(event.created_at / 3600) * 3600
      : Math.floor(event.created_at / 86400) * 86400;

    const featureKey = `${event.service_name}.${event.action}`;
    const key = `${event.user_id}:${event.license_nonce}:${featureKey}:${timestamp}`;

    const existing = aggregationMap.get(key) || {
      tenantId: event.user_id,
      licenseNonce: event.license_nonce,
      featureKey,
      timestamp,
      consumedUnits: 0,
      requestCount: 0,
      tokensInput: 0,
      tokensOutput: 0,
      avgResponseTimeMs: 0,
      errorCount: 0,
    };

    existing.consumedUnits += event.credits_used || 0;
    existing.requestCount += 1;
    existing.tokensInput += event.tokens_input || 0;
    existing.tokensOutput += event.tokens_output || 0;

    if (!event.status_code || event.status_code >= 400) {
      existing.errorCount += 1;
    }

    const totalRt = existing.avgResponseTimeMs * (existing.requestCount - 1) + (event.response_time_ms || 0);
    existing.avgResponseTimeMs = totalRt / existing.requestCount;

    aggregationMap.set(key, existing);
  }

  return Array.from(aggregationMap.values());
}

/**
 * Build hourly summary from aggregated events.
 */
export function buildHourlySummary(aggregatedEvents: AggregatedUsage[]): HourlySummary[] {
  const hourlyMap = new Map<number, HourlySummary>();

  for (const event of aggregatedEvents) {
    const hourTs = event.timestamp;
    const existing = hourlyMap.get(hourTs) || {
      hourTimestamp: hourTs,
      serviceBreakdown: [],
      totalCredits: 0,
      totalRequests: 0,
      totalTokens: 0,
    };

    const existingService = existing.serviceBreakdown.find(
      s => s.featureKey === event.featureKey && s.licenseNonce === event.licenseNonce
    );

    if (existingService) {
      existingService.consumedUnits += event.consumedUnits;
      existingService.requestCount += event.requestCount;
      existingService.tokensInput += event.tokensInput;
      existingService.tokensOutput += event.tokensOutput;
    } else {
      existing.serviceBreakdown.push({ ...event });
    }

    existing.totalCredits += event.consumedUnits;
    existing.totalRequests += event.requestCount;
    existing.totalTokens += event.tokensInput + event.tokensOutput;

    hourlyMap.set(hourTs, existing);
  }

  return Array.from(hourlyMap.values()).sort((a, b) => a.hourTimestamp - b.hourTimestamp);
}

/**
 * Build daily summary from hourly summaries.
 */
export function buildDailySummary(hourlySummaries: HourlySummary[]): DailySummary[] {
  const dailyMap = new Map<number, DailySummary>();

  for (const hourly of hourlySummaries) {
    const dayTs = Math.floor(hourly.hourTimestamp / 86400) * 86400;
    const existing = dailyMap.get(dayTs) || {
      dayTimestamp: dayTs,
      hourlyBreakdown: [],
      totalCredits: 0,
      totalRequests: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
    };

    existing.hourlyBreakdown.push(hourly);
    existing.totalCredits += hourly.totalCredits;
    existing.totalRequests += hourly.totalRequests;

    for (const service of hourly.serviceBreakdown) {
      existing.totalTokensInput += service.tokensInput;
      existing.totalTokensOutput += service.tokensOutput;
    }

    dailyMap.set(dayTs, existing);
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.dayTimestamp - b.dayTimestamp);
}
