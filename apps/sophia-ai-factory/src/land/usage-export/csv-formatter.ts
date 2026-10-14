/**
 * CSV Formatter for Usage Export
 *
 * RFC 4180 compliant CSV generation for usage data export
 * Handles special characters, commas, quotes, and newlines
 */

import type { UsageExportRecord } from './types';
import { escapeCSVField, buildCSVHeader } from './csv-escape-helpers';

export { escapeCSVField, buildCSVHeader };

/**
 * Convert usage export records to CSV format
 */
export function formatAsCSV(
  data: UsageExportRecord[],
  options: {
    includeHeader?: boolean;
    delimiter?: string;
    lineEnding?: string;
    fields?: (keyof UsageExportRecord)[];
    forceQuotes?: boolean;
  } = {},
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

  const fieldsToUse =
    fields || (Object.keys(data[0]) as (keyof UsageExportRecord)[]);

  const rows: string[] = [];

  if (includeHeader) {
    const headerRow = fieldsToUse
      .map((field) => escapeCSVField(String(field), { forceQuotes: false }))
      .join(delimiter);
    rows.push(headerRow);
  }

  for (const record of data) {
    const row = fieldsToUse
      .map((field) =>
        escapeCSVField(record[field], {
          doubleQuotes: true,
          forceQuotes,
        }),
      )
      .join(delimiter);
    rows.push(row);
  }

  return rows.join(lineEnding);
}

/**
 * Convert aggregated usage data to CSV format
 */
export function formatSummaryAsCSV(summary: {
  totalRequests: number;
  totalCredits: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCostUsd?: number | null;
  byService: Record<
    string,
    {
      requests: number;
      credits: number;
      tokensInput: number;
      tokensOutput: number;
    }
  >;
}): string {
  const rows: string[] = [];

  rows.push('Metric,Value');
  rows.push(`Total Requests,${summary.totalRequests}`);
  rows.push(`Total Credits,${summary.totalCredits}`);
  rows.push(`Total Input Tokens,${summary.totalTokensInput}`);
  rows.push(`Total Output Tokens,${summary.totalTokensOutput}`);
  if (summary.totalCostUsd !== null && summary.totalCostUsd !== undefined) {
    rows.push(`Total Cost USD,${summary.totalCostUsd.toFixed(2)}`);
  }

  rows.push('');
  rows.push('Service Breakdown');
  rows.push('Service,Requests,Credits,Input Tokens,Output Tokens');

  for (const [service, stats] of Object.entries(summary.byService)) {
    rows.push(
      `${escapeCSVField(service)},${stats.requests},${stats.credits},${stats.tokensInput},${stats.tokensOutput}`,
    );
  }

  return rows.join('\r\n');
}
