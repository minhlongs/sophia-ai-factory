/**
 * Usage Event Collector
 *
 * Transforms raw usage events into aggregated summaries.
 * Pure in-memory aggregation — no database I/O.
 *
 * @module usage-metering/usage-event-collector
 */

import type { AggregatedUsage } from './types';

export { generateCsvRows, rowsToCsv } from './usage-csv-generator';
export { buildHourlySummary, buildDailySummary } from './usage-summary-builders';

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
