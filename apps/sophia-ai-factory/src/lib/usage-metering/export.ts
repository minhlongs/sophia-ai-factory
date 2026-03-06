/**
 * Usage Metering Export
 *
 * Export utilities for billing and analytics
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { ExportOptions, UsageSummary, DailyUsage } from './types';
import { generateCsvRows, rowsToCsv, getAggregatedSummary } from './aggregator';

/**
 * Export usage data for billing
 *
 * @param options - Export options
 */
export async function exportUsage(options: ExportOptions): Promise<{
  summary: UsageSummary[];
  daily: DailyUsage[];
  events: unknown[];
  aggregated?: {
    hourly: import('./types').HourlySummary[];
    daily: import('./types').DailySummary[];
    totalCredits: number;
    totalRequests: number;
  };
}> {
  const supabase = createAdminClient();

  // Get raw events for aggregation
  let query = supabase
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

  const { data: rawEvents, error: eventsError } = await query as any;

  if (eventsError) {
    logger.error('[Usage Export] Failed to get events', eventsError);
    throw eventsError;
  }

  const events = (rawEvents ?? []) as Array<{
    service_name: string;
    tokens_input: number;
    tokens_output: number;
    credits_used: number;
  }>;

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
  const daily = aggregated.daily.flatMap((day: any) =>
    day.hourlyBreakdown.map((hourly: any) => ({
      day_timestamp: day.dayTimestamp,
      service_name: hourly.serviceBreakdown[0]?.service_name || 'unknown',
      requests: hourly.totalRequests,
      credits: hourly.totalCredits,
    }))
  ) as unknown as DailyUsage[];

  // Get raw events for export
  let exportEvents: unknown[] = [];
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
export function generateCsv(events: unknown[]): string {
  if (!events || events.length === 0) {
    return '';
  }

  // Use new aggregator CSV generation with standardized fields
  const csvRows = generateCsvRows(events as any);
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
