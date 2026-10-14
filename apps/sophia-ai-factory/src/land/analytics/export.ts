/**
 * Analytics Data Export
 *
 * Export analytics data to CSV format
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { UsageEventRow } from '@/tree/database/supabase-types';
import {
  generateUsageCsvRows,
  rowsToCsv,
  downloadCsv,
  type ExportOptions,
  type UsageCsvRow,
} from './analytics-export-formatters';

export {
  generateUsageCsvRows,
  rowsToCsv,
  downloadCsv,
  type ExportOptions,
  type UsageCsvRow,
} from './analytics-export-formatters';

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
