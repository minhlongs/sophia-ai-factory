/**
 * CSV Row Formatting and Client Download Helpers for Analytics Export
 * @module land/analytics/analytics-export-formatters
 */

import type { UsageEventRow } from '@/tree/database/supabase-types';

export interface ExportOptions {
  userId: string;
  licenseNonce?: string;
  startTimestamp: number;
  endTimestamp: number;
  isAdmin: boolean;
  [key: string]: unknown;
}

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

function formatCurrency(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

export function generateUsageCsvRows(events: UsageEventRow[]): UsageCsvRow[] {
  const rows: UsageCsvRow[] = [];

  for (const event of events) {
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

export function rowsToCsv(rows: UsageCsvRow[]): string {
  if (rows.length === 0) {
    return 'No data available';
  }

  const headers = [
    'Timestamp',
    'Service',
    'Action',
    'Credits',
    'Tokens Input',
    'Tokens Output',
    'Cost (USD)',
    'Status',
    'Response Time (ms)',
  ];

  const csvRows = rows.map((row) =>
    [
      row.timestamp,
      row.service,
      row.action,
      row.credits,
      row.tokensInput,
      row.tokensOutput,
      formatCurrency(row.cost),
      row.status,
      row.responseTimeMs,
    ]
      .map((value) => {
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(','),
  );

  return [headers.join(','), ...csvRows].join('\n');
}

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
