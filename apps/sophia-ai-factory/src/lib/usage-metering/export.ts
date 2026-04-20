/**
 * Usage Metering Export
 *
 * Export utilities for billing and analytics
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { ExportOptions, UsageSummary, DailyUsage } from './types';
import type { D1Response } from '@/lib/db/types';
import { generateCsvRows, rowsToCsv, getAggregatedSummary } from './aggregator';

/** Raw usage event row returned from D1 export queries */
type UsageEventExportRow = {
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
};

/**
 * Export usage data for billing
 *
 * @param options - Export options
 */
export async function exportUsage(options: ExportOptions): Promise<{
  summary: UsageSummary[];
  daily: DailyUsage[];
  events: UsageEventExportRow[];
  aggregated?: {
    hourly: import('./types').HourlySummary[];
    daily: import('./types').DailySummary[];
    totalCredits: number;
    totalRequests: number;
  };
}> {
  const db = createServerClient();

  // Get raw events for aggregation
  let query = db
    .from('usage_events')
    .select('*')
    .order('created_at', { ascending: true });

  if (options.licenseNonce) {
    query = query.eq('license_nonce', options.licenseNonce);
  }
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }
  if (options.service) {
    query = query.eq('service_name', options.service);
  }
  query = query
    .gte('created_at', options.startTimestamp)
    .lte('created_at', options.endTimestamp);

  const { data: rawEvents, error: eventsError } = await query as unknown as D1Response<UsageEventExportRow[]>;

  if (eventsError) {
    const err = eventsError instanceof Error ? eventsError : new Error(String(eventsError));
    logger.error('[Usage Export] Failed to get events', err);
    throw err;
  }

  const events: UsageEventExportRow[] = rawEvents ?? [];

  // Aggregate summary manually (backward compatible)
  const summaryMap = new Map<string, UsageSummary>();
  for (const event of events) {
    const existing = summaryMap.get(event.service_name) || {
      service_name: event.service_name,
      total_requests: 0,
      total_tokens_input: 0,
      total_tokens_output: 0,
      total_credits: 0,
    };
    existing.total_requests += 1;
    existing.total_tokens_input += event.tokens_input ?? 0;
    existing.total_tokens_output += event.tokens_output ?? 0;
    existing.total_credits += event.credits_used ?? 0;
    summaryMap.set(event.service_name, existing);
  }

  const summary = Array.from(summaryMap.values()) as unknown as UsageSummary[];

  // Get aggregated data using new aggregator
  const aggregated = await getAggregatedSummary(
    options.userId || '',
    options.startTimestamp,
    options.endTimestamp,
    options.licenseNonce
  );

  // Daily breakdown from aggregated data
  const daily = aggregated.daily.flatMap((day) =>
    day.hourlyBreakdown.map((hourly) => ({
      day_timestamp: day.dayTimestamp,
      service_name: hourly.serviceBreakdown[0]?.featureKey || 'unknown',
      requests: hourly.totalRequests,
      credits: hourly.totalCredits,
    }))
  ) as unknown as DailyUsage[];

  // Get raw events for export
  let exportEvents: UsageEventExportRow[] = [];
  if (options.format === 'json') {
    exportEvents = rawEvents ?? [];
  }

  return {
    summary,
    daily,
    events: exportEvents,
    aggregated: options.format === 'json' ? aggregated : undefined,
  };
}

/**
 * Generate CSV export from events
 *
 * @param events - Usage events
 */
export function generateCsv(events: Array<{
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
}>): string {
  if (!events || events.length === 0) {
    return '';
  }

  // Use new aggregator CSV generation with standardized fields
  const csvRows = generateCsvRows(events);
  return rowsToCsv(csvRows);
}

/**
 * Get usage summary for a specific license
 *
 * @param licenseNonce - License nonce
 * @param period - Period string (current_month, last_month, last_7_days, last_30_days)
 */
export async function getUsageSummaryForPeriod(
  licenseNonce: string,
  period: string = 'current_month'
): Promise<{
  summary: UsageSummary[];
  totalCredits: number;
  startTimestamp: number;
  endTimestamp: number;
  hourly?: import('./types').HourlySummary[];
  daily?: import('./types').DailySummary[];
}> {
  const now = Math.floor(Date.now() / 1000);
  let startTimestamp: number;
  let endTimestamp: number = now;

  const date = new Date();

  switch (period) {
    case 'current_month':
      startTimestamp = Math.floor(new Date(date.getFullYear(), date.getMonth(), 1).getTime() / 1000);
      break;
    case 'last_month':
      date.setMonth(date.getMonth() - 1);
      startTimestamp = Math.floor(new Date(date.getFullYear(), date.getMonth(), 1).getTime() / 1000);
      endTimestamp = Math.floor(new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime() / 1000);
      break;
    case 'last_7_days':
      startTimestamp = now - (7 * 86400);
      break;
    case 'last_30_days':
    default:
      startTimestamp = now - (30 * 86400);
      break;
  }

  const { summary, aggregated } = await exportUsage({
    licenseNonce,
    startTimestamp,
    endTimestamp,
    format: 'json',
  });

  const totalCredits = aggregated?.totalCredits || summary.reduce((sum, s) => sum + s.total_credits, 0);

  return {
    summary,
    totalCredits,
    startTimestamp,
    endTimestamp,
    hourly: aggregated?.hourly,
    daily: aggregated?.daily,
  };
}
