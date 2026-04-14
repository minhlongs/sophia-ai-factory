/**
 * Usage Event Collector
 *
 * Transforms raw usage events into aggregated summaries and CSV exports.
 * Pure in-memory aggregation — no database I/O.
 *
 * @module usage-metering/usage-event-collector
 */

import type {
  AggregatedUsage,
  HourlySummary,
  DailySummary,
  CsvExportRow,
} from './types';

/**
 * Aggregate raw usage events into time-windowed summaries
 *
 * @param events - Raw usage events from database
 * @param windowSize - 'hour' or 'day' aggregation window
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
 * Build hourly summary from aggregated events
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
 * Build daily summary from hourly summaries
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

// -------------------------------------------------------------------------
// CSV generation
// -------------------------------------------------------------------------

/**
 * Escape CSV field to prevent CSV injection attacks
 */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';

  const str = String(value);
  const dangerousPrefixes = ['=', '+', '-', '@'];

  if (dangerousPrefixes.some(prefix => str.startsWith(prefix))) {
    return `'${str}'`;
  }

  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generate CSV export rows from raw usage events
 */
export function generateCsvRows(events: Array<{
  user_id: string;
  license_nonce: string;
  service_name: string;
  action: string;
  credits_used: number;
  tokens_input: number;
  tokens_output: number;
  status_code: number | null;
  response_time_ms: number | null;
  created_at: number;
  external_customer_id?: string | null;
}>): CsvExportRow[] {
  return events.map(event => ({
    tenant_id: event.user_id,
    feature_key: `${event.service_name}.${event.action}`,
    timestamp: event.created_at,
    consumed_units: event.credits_used,
    request_count: 1,
    tokens_input: event.tokens_input,
    tokens_output: event.tokens_output,
    license_nonce: event.license_nonce,
    service: event.service_name,
    action: event.action,
    status: (!event.status_code || event.status_code >= 400) ? 'error' : 'success',
    response_time_ms: event.response_time_ms,
    external_customer_id: event.external_customer_id || null,
  }));
}

/**
 * Convert CSV rows to CSV string
 */
export function rowsToCsv(rows: CsvExportRow[]): string {
  if (rows.length === 0) return '';

  const headers = [
    'tenant_id', 'feature_key', 'timestamp', 'consumed_units',
    'request_count', 'tokens_input', 'tokens_output', 'license_nonce',
    'service', 'action', 'status', 'response_time_ms',
  ];

  const csvRows = rows.map(row => [
    escapeCsvField(row.tenant_id),
    escapeCsvField(row.feature_key),
    escapeCsvField(row.timestamp),
    escapeCsvField(row.consumed_units),
    escapeCsvField(row.request_count),
    escapeCsvField(row.tokens_input),
    escapeCsvField(row.tokens_output),
    escapeCsvField(row.license_nonce),
    escapeCsvField(row.service),
    escapeCsvField(row.action),
    escapeCsvField(row.status),
    escapeCsvField(row.response_time_ms),
  ].join(','));

  return [headers.join(','), ...csvRows].join('\n');
}
