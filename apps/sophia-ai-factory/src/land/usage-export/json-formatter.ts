/**
 * JSON Formatter for Usage Export
 *
 * Pretty-print JSON formatting for usage data export
 * Includes metadata, summary, and records in structured format
 */

import type {
  UsageExportRecord,
  UsageExportSummary,
  UsageExportResponse,
  BillingPeriod,
  ExportFormat,
} from './types';

export {
  formatAsJSON,
  formatSummaryAsJSON,
  createJSONDownload,
  type JSONFormatOptions,
} from './json-formatter-helpers';

/**
 * Format complete API response for usage export
 *
 * Creates structured response with metadata, summary, records, and pagination
 *
 * @param params - Response parameters
 * @returns Formatted usage export response object
 *
 * @example
 * ```typescript
 * const response = formatExportResponse({
 *   records,
 *   summary,
 *   format: 'json',
 *   billingPeriod: 'monthly',
 *   periodStart: 1709251200,
 *   periodEnd: 1711929599,
 *   filters: { customerId: 'cust_123' },
 *   pagination: { currentPage: 1, totalPages: 5, pageSize: 100, totalRecords: 450 }
 * });
 * ```
 */
export function formatExportResponse(params: {
  /** Exported records */
  records: UsageExportRecord[];
  /** Aggregated summary statistics */
  summary: UsageExportSummary;
  /** Output format */
  format: ExportFormat;
  /** Billing period type */
  billingPeriod: BillingPeriod;
  /** Period start timestamp (Unix seconds) */
  periodStart: number;
  /** Period end timestamp (Unix seconds) */
  periodEnd: number;
  /** Applied filters */
  filters: {
    customerId?: string | null;
    service?: string | null;
    licenseNonce?: string | null;
  };
  /** Pagination info (optional) */
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalRecords: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } | null;
}): UsageExportResponse {
  const {
    records,
    summary,
    format,
    billingPeriod,
    periodStart,
    periodEnd,
    filters,
    pagination = null,
  } = params;

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      format,
      billingPeriod,
      periodStart,
      periodEnd,
      filters: {
        customerId: filters.customerId ?? null,
        service: filters.service ?? null,
        licenseNonce: filters.licenseNonce ?? null,
      },
    },
    summary,
    records,
    pagination: pagination ?? null,
  };
}
