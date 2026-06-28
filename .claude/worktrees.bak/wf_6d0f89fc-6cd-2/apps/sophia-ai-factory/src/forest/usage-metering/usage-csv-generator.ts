/**
 * Usage CSV Generator
 *
 * Converts raw usage events to CSV rows and CSV strings.
 * Pure transformation — no database I/O.
 *
 * @module usage-metering/usage-csv-generator
 */

import type { CsvExportRow } from './types';

/**
 * Escape CSV field to prevent CSV injection attacks.
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
 * Generate CSV export rows from raw usage events.
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
 * Convert CSV rows to CSV string.
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
