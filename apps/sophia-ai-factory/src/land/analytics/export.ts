/**
 * Analytics Data Export
 *
 * Export analytics data to CSV format
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { UsageEventRow } from '@/land/supabase/types';

/**
 * Export options
 */
export interface ExportOptions {
  userId: string;
  licenseNonce?: string;
  startTimestamp: number;
  endTimestamp: number;
  isAdmin: boolean;
  [key: string]: unknown;
}

/**
 * CSV Row structure
 */
export interface UsageCsvRow {
  timestamp: string;
  service: string;
  action: string;
  credits: number;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  status: string;
  responseTimeMs: number;
}

/**
 * Format number as currency USD
 */
function formatCurrency(value: number): string {
  return `$${(value).toFixed(4)}`;
}

/**
 * Format timestamp to ISO string
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Generate CSV rows from usage events
 */
export function generateUsageCsvRows(events: UsageEventRow[]): UsageCsvRow[] {
  const rows: UsageCsvRow[] = [];

  for (const event of events) {
    // Cost calculation: $0.01 per credit (baseline rate)
    const cost = (event.credits_used || 0) * 0.01;

    rows.push({
      timestamp: formatTimestamp(event.created_at),
      service: event.service_name || 'unknown',
      action: event.action || 'unknown',
      credits: event.credits_used || 0,
      tokensInput: event.tokens_input || 0,
      tokensOutput: event.tokens_output || 0,
      cost,
      status: event.status_code && event.status_code < 400 ? 'success' : 'error',
      responseTimeMs: event.response_time_ms || 0,
    });
  }

  return rows;
}

/**
 * Convert rows to CSV string
 */
export function rowsToCsv(rows: UsageCsvRow[]): string {
  if (rows.length === 0) {
    return 'No data available';
  }

  // CSV Header
  const headers = ['Timestamp', 'Service', 'Action', 'Credits', 'Tokens Input', 'Tokens Output', 'Cost (USD)', 'Status', 'Response Time (ms)'];

  // CSV Rows
  const csvRows = rows.map(row => [
    row.timestamp,
    row.service,
    row.action,
    row.credits,
    row.tokensInput,
    row.tokensOutput,
    formatCurrency(row.cost),
    row.status,
    row.responseTimeMs,
  ].map(value => {
    // Escape values that contain commas or quotes
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }).join(','));

  return [headers.join(','), ...csvRows].join('\n');
}

/**
 * Fetch usage events for export
 */
export async function fetchUsageForExport(options: ExportOptions): Promise<UsageEventRow[]> {
  const db = createServerClient();

  // Validate date range (max 90 days)
  const dateRangeDays = (options.endTimestamp - options.startTimestamp) / 86400;
  if (dateRangeDays > 90) {
    throw new Error('Date range exceeds maximum of 90 days');
  }

  let query = db
    .from('usage_events')
    .select('*')
    .gte('created_at', options.startTimestamp)
    .lte('created_at', options.endTimestamp)
    .order('created_at', { ascending: true });

  // Apply license filter
  if (options.licenseNonce) {
    query = query.eq('license_nonce', options.licenseNonce);
  } else if (!options.isAdmin) {
    // Auto-filter to user's own data for non-admin
    query = query.eq('user_id', options.userId);
  }

  const { data: events, error } = await query as unknown as { data: UsageEventRow[]; error: unknown };

  if (error) {
    logger.error('[Analytics Export] Failed to fetch usage events', toError(error));
    throw new Error('Failed to fetch usage data for export');
  }

  return events || [];
}

/**
 * Export usage data to CSV
 */
export async function exportUsageToCsv(options: ExportOptions): Promise<{
  csv: string;
  filename: string;
  rowCount: number;
}> {
  logger.info('[Analytics Export] Starting CSV export', options);

  // Fetch data
  const events = await fetchUsageForExport(options);

  // Generate CSV
  const rows = generateUsageCsvRows(events);
  const csv = rowsToCsv(rows);

  // Generate filename
  const filename = `analytics-${options.startTimestamp}-${options.endTimestamp}.csv`;

  logger.info('[Analytics Export] Export complete', {
    rowCount: rows.length,
    filename,
  });

  return {
    csv,
    filename,
    rowCount: rows.length,
  };
}

/**
 * Download helper for client-side
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
