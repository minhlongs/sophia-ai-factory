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

/**
 * JSON formatting options
 */
interface JSONFormatOptions {
  /** Indentation spaces (default: 2) */
  indent?: number;
  /** Include null fields (default: false) */
  includeNulls?: boolean;
  /** Custom field filter */
  fieldFilter?: (key: string, value: unknown) => boolean;
}

/**
 * Remove null/undefined fields from object
 */
function removeNulls(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeNulls(item));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleaned = removeNulls(value);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result;
  }

  return obj;
}

/**
 * Format usage export data as JSON string
 *
 * @param data - Usage export records or response object
 * @param options - JSON formatting options
 * @returns Pretty-printed JSON string
 *
 * @example
 * ```typescript
 * const json = formatAsJSON(records, { indent: 2 });
 * ```
 */
export function formatAsJSON(
  data: UsageExportRecord[] | UsageExportResponse,
  options: JSONFormatOptions = {}
): string {
  const { indent = 2, includeNulls = false } = options;

  const output = includeNulls ? data : removeNulls(data);

  return JSON.stringify(output, null, indent);
}

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

/**
 * Format usage summary for JSON export
 *
 * @param summary - Raw summary data
 * @returns Formatted JSON string
 */
export function formatSummaryAsJSON(
  summary: UsageExportSummary,
  options?: JSONFormatOptions
): string {
  const { indent = 2, includeNulls = false } = options || {};
  const output = includeNulls ? summary : removeNulls(summary);
  return JSON.stringify(output, null, indent);
}

/**
 * Create downloadable JSON response
 *
 * @param response - Complete export response
 * @param filename - Optional filename for download
 * @returns Object with JSON string and filename
 */
export function createJSONDownload(
  response: UsageExportResponse,
  filename?: string
): {
  content: string;
  filename: string;
  contentType: string;
} {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const defaultFilename = `usage-export-${timestamp}.json`;

  return {
    content: formatAsJSON(response),
    filename: filename || defaultFilename,
    contentType: 'application/json',
  };
}
