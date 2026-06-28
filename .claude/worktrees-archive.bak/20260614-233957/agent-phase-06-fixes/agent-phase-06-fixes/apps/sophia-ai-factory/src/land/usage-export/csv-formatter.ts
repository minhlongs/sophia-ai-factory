/**
 * CSV Formatter for Usage Export
 *
 * RFC 4180 compliant CSV generation for usage data export
 * Handles special characters, commas, quotes, and newlines
 */

import type { UsageExportRecord } from './types';

/**
 * CSV field escaping options
 */
interface EscapeOptions {
  /** Escape quotes by doubling them (RFC 4180) */
  doubleQuotes?: boolean;
  /** Wrap all fields in quotes */
  forceQuotes?: boolean;
}

/**
 * Escape a single CSV field according to RFC 4180
 *
 * - Fields containing commas, quotes, or newlines must be quoted
 * - Quotes within fields are escaped by doubling them
 * - Leading/trailing spaces are preserved in quoted fields
 */
export function escapeCSVField(
  field: unknown,
  options: EscapeOptions = { doubleQuotes: true, forceQuotes: false }
): string {
  if (field === null || field === undefined) {
    return '';
  }

  const value = String(field);

  // Check if field needs quoting
  const needsQuoting =
    options.forceQuotes ||
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.startsWith(' ') ||
    value.endsWith(' ');

  if (needsQuoting) {
    // Escape quotes by doubling them (RFC 4180)
    const escapedValue = options.doubleQuotes
      ? value.replace(/"/g, '""')
      : value;
    return `"${escapedValue}"`;
  }

  return value;
}

/**
 * Build CSV header row from field names
 *
 * @param fields - Array of field names to include in header
 * @returns CSV header row string
 */
export function buildCSVHeader(fields: string[]): string {
  return fields
    .map((field) => escapeCSVField(field, { forceQuotes: false }))
    .join(',');
}

/**
 * Convert usage export records to CSV format
 *
 * @param data - Array of usage export records
 * @param options - CSV formatting options
 * @returns RFC 4180 compliant CSV string
 *
 * @example
 * ```typescript
 * const csv = formatAsCSV(records, {
 *   includeHeader: true,
 *   delimiter: ',',
 *   lineEnding: '\r\n' // Default for RFC 4180
 * });
 * ```
 */
export function formatAsCSV(
  data: UsageExportRecord[],
  options: {
    /** Include header row (default: true) */
    includeHeader?: boolean;
    /** Field delimiter (default: ',') */
    delimiter?: string;
    /** Line ending (default: '\r\n' for RFC 4180) */
    lineEnding?: string;
    /** Specific fields to include (default: all fields) */
    fields?: (keyof UsageExportRecord)[];
    /** Force quote all fields */
    forceQuotes?: boolean;
  } = {}
): string {
  const {
    includeHeader = true,
    delimiter = ',',
    lineEnding = '\r\n',
    fields,
    forceQuotes = false,
  } = options;

  if (data.length === 0) {
    return '';
  }

  // Determine fields to include
  const fieldsToUse =
    fields || (Object.keys(data[0]) as (keyof UsageExportRecord)[]);

  const rows: string[] = [];

  // Add header row
  if (includeHeader) {
    const headerRow = fieldsToUse
      .map((field) =>
        escapeCSVField(String(field), { forceQuotes: false })
      )
      .join(delimiter);
    rows.push(headerRow);
  }

  // Add data rows
  for (const record of data) {
    const row = fieldsToUse
      .map((field) =>
        escapeCSVField(record[field], {
          doubleQuotes: true,
          forceQuotes,
        })
      )
      .join(delimiter);
    rows.push(row);
  }

  return rows.join(lineEnding);
}

/**
 * Convert aggregated usage data to CSV format
 *
 * @param summary - Usage summary data with byService and byDay breakdowns
 * @returns CSV string with summary statistics
 */
export function formatSummaryAsCSV(summary: {
  totalRequests: number;
  totalCredits: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCostUsd?: number | null;
  byService: Record<string, {
    requests: number;
    credits: number;
    tokensInput: number;
    tokensOutput: number;
  }>;
}): string {
  const rows: string[] = [];

  // Summary header
  rows.push('Metric,Value');
  rows.push(`Total Requests,${summary.totalRequests}`);
  rows.push(`Total Credits,${summary.totalCredits}`);
  rows.push(`Total Input Tokens,${summary.totalTokensInput}`);
  rows.push(`Total Output Tokens,${summary.totalTokensOutput}`);
  if (summary.totalCostUsd !== null && summary.totalCostUsd !== undefined) {
    rows.push(`Total Cost USD,${summary.totalCostUsd.toFixed(2)}`);
  }

  // Service breakdown
  rows.push('');
  rows.push('Service Breakdown');
  rows.push('Service,Requests,Credits,Input Tokens,Output Tokens');

  for (const [service, stats] of Object.entries(summary.byService)) {
    rows.push(
      `${escapeCSVField(service)},${stats.requests},${stats.credits},${stats.tokensInput},${stats.tokensOutput}`
    );
  }

  return rows.join('\r\n');
}
