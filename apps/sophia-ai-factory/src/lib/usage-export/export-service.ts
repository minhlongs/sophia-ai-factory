/**
 * Usage Export Service
 *
 * Core service for querying and exporting usage data
 * Provides database queries, formatters, and aggregation functions
 */

import { createServerClient } from '../db/client';
import { logger } from '../utils/logger-utility';
import type { UsageEventRow } from '../supabase/types';
import type {
  UsageExportRecord,
  UsageExportSummary,
  BillingPeriod,
  UsageExportResponse,
  ExportFormat,
} from './types';
import { formatAsCSV, formatSummaryAsCSV } from './csv-formatter';
import { formatAsJSON, formatExportResponse, createJSONDownload } from './json-formatter';

/**
 * Parameters for querying usage export data
 */
export interface GetUsageExportParams {
  /**
   * Billing period for aggregation
   * - weekly: Last 7 days from now
   * - monthly: Current calendar month
   * - custom: Use provided startDate/endDate
   */
  billingPeriod: BillingPeriod;

  /**
   * Optional external customer ID filter
   */
  externalCustomerId?: string | null;

  /**
   * Optional start timestamp for custom period (Unix seconds)
   */
  startDate?: number | null;

  /**
   * Optional end timestamp for custom period (Unix seconds)
   */
  endDate?: number | null;

  /**
   * Optional service filter (heygen, elevenlabs, openrouter)
   */
  service?: string | null;

  /**
   * Optional license nonce filter
   */
  licenseNonce?: string | null;

  /**
   * Pagination: page number (1-indexed, default: 1)
   */
  page?: number;

  /**
   * Pagination: page size (default: 100, max: 1000)
   */
  pageSize?: number;
}

/**
 * Calculate date range for billing period
 */
function getDateRange(
  billingPeriod: BillingPeriod,
  startDate?: number | null,
  endDate?: number | null
): { periodStart: number; periodEnd: number } {
  const now = Math.floor(Date.now() / 1000);

  if (billingPeriod === 'custom') {
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required for custom billing period');
    }
    return { periodStart: startDate, periodEnd: endDate };
  }

  if (billingPeriod === 'weekly') {
    const periodStart = now - (7 * 24 * 60 * 60); // 7 days ago
    return { periodStart, periodEnd: now };
  }

  if (billingPeriod === 'monthly') {
    // Current calendar month
    const nowDate = new Date();
    const periodStart = Math.floor(
      new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime() / 1000
    );
    const periodEnd = Math.floor(
      new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000
    );
    return { periodStart, periodEnd };
  }

  // Default to weekly
  const periodStart = now - (7 * 24 * 60 * 60);
  return { periodStart, periodEnd: now };
}

/**
 * Map database row to export record format
 */
function mapToExportRecord(row: {
  id: string;
  user_id: string;
  license_nonce: string;
  service_name: string;
  action: string;
  tokens_input: number;
  tokens_output: number;
  credits_used: number;
  status_code: number | null;
  response_time_ms: number | null;
  created_at: number;
  external_customer_id: string | null;
}): UsageExportRecord {
  return {
    id: row.id || crypto.randomUUID(),
    tenant_id: row.user_id,
    feature_key: `${row.service_name}.${row.action}`,
    quantity: row.credits_used,
    timestamp: row.created_at,
    license_nonce: row.license_nonce,
    service: row.service_name,
    action: row.action,
    tokens_input: row.tokens_input || 0,
    tokens_output: row.tokens_output || 0,
    request_count: 1,
    status: row.status_code && row.status_code >= 200 && row.status_code < 300 ? 'success' : 'error',
    response_time_ms: row.response_time_ms || null,
    external_customer_id: row.external_customer_id || null,
  };
}

/**
 * Calculate usage summary from records
 */
function calculateSummary(records: UsageExportRecord[]): UsageExportSummary {
  const summary: UsageExportSummary = {
    totalRequests: 0,
    totalCredits: 0,
    totalTokensInput: 0,
    totalTokensOutput: 0,
    byService: {},
  };

  for (const record of records) {
    summary.totalRequests++;
    summary.totalCredits += record.quantity;
    summary.totalTokensInput += record.tokens_input;
    summary.totalTokensOutput += record.tokens_output;

    // By service breakdown
    if (!summary.byService[record.service]) {
      summary.byService[record.service] = {
        requests: 0,
        credits: 0,
        tokensInput: 0,
        tokensOutput: 0,
      };
    }
    summary.byService[record.service].requests++;
    summary.byService[record.service].credits += record.quantity;
    summary.byService[record.service].tokensInput += record.tokens_input;
    summary.byService[record.service].tokensOutput += record.tokens_output;
  }

  return summary;
}

/**
 * Query usage events from database with filters and pagination
 *
 * @param params - Query parameters including filters and pagination
 * @returns Object with records, total count, and pagination info
 *
 * @example
 * ```typescript
 * const { records, totalCount, pagination } = await getUsageExportData({
 *   billingPeriod: 'monthly',
 *   externalCustomerId: 'cust_123',
 *   page: 1,
 *   pageSize: 100
 * });
 * ```
 */
export async function getUsageExportData(
  params: GetUsageExportParams
): Promise<{
  records: UsageExportRecord[];
  totalCount: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalRecords: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  periodStart: number;
  periodEnd: number;
}> {
  const { page = 1, pageSize = 100 } = params;

  logger.info('[UsageExport] Querying usage data', {
    billingPeriod: params.billingPeriod,
    externalCustomerId: params.externalCustomerId,
    service: params.service,
    page,
    pageSize,
  });

  try {
    const { periodStart, periodEnd } = getDateRange(
      params.billingPeriod,
      params.startDate,
      params.endDate
    );

    const db = createServerClient();

    // Build query with filters
    let query = db
      .from('usage_events')
      .select('*', { count: 'exact' })
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    // Apply optional filters
    if (params.externalCustomerId) {
      query = query.eq('external_customer_id', params.externalCustomerId);
    }

    if (params.service) {
      query = query.eq('service_name', params.service);
    }

    if (params.licenseNonce) {
      query = query.eq('license_nonce', params.licenseNonce);
    }

    const { data: rows, error, count } = await query;

    if (error) {
      logger.error('[UsageExport] Database query failed', error, {
        billingPeriod: params.billingPeriod,
      });
      throw new Error(`Database query failed: ${error.message}`);
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Map rows to export records
    const records = (rows || []).map((row: UsageEventRow) => mapToExportRecord(row));

    logger.info('[UsageExport] Query completed', {
      totalRecords: totalCount,
      returnedRecords: records.length,
      totalPages,
    });

    return {
      records,
      totalCount,
      pagination: {
        currentPage: page,
        totalPages,
        pageSize,
        totalRecords: totalCount,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      periodStart,
      periodEnd,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[UsageExport] Query failed', err, {
      billingPeriod: params.billingPeriod,
    });
    throw error;
  }
}

/**
 * Export usage data to CSV format
 *
 * @param records - Array of usage export records
 * @param options - CSV formatting options
 * @returns CSV string ready for download
 *
 * @example
 * ```typescript
 * const csv = exportToCSV(records, { includeHeader: true });
 * ```
 */
export function exportToCSV(
  records: UsageExportRecord[],
  options?: {
    includeHeader?: boolean;
    fields?: (keyof UsageExportRecord)[];
  }
): string {
  logger.info('[UsageExport] Converting to CSV', { recordCount: records.length });

  return formatAsCSV(records, {
    includeHeader: options?.includeHeader ?? true,
    fields: options?.fields,
  });
}

/**
 * Export usage data to JSON format
 *
 * @param records - Array of usage export records
 * @param options - JSON formatting options
 * @returns Pretty-printed JSON string
 *
 * @example
 * ```typescript
 * const json = exportToJSON(records, { indent: 2 });
 * ```
 */
export function exportToJSON(
  records: UsageExportRecord[],
  options?: { indent?: number }
): string {
  logger.info('[UsageExport] Converting to JSON', { recordCount: records.length });

  return formatAsJSON(records, {
    indent: options?.indent ?? 2,
  });
}

/**
 * Generate export summary with totals, credits, and overage info
 *
 * @param records - Array of usage export records
 * @returns Summary statistics object
 *
 * @example
 * ```typescript
 * const summary = generateExportSummary(records);
 * // { totalRequests: 100, totalCredits: 500, ... }
 * ```
 */
export function generateExportSummary(
  records: UsageExportRecord[]
): UsageExportSummary {
  logger.info('[UsageExport] Generating summary', { recordCount: records.length });

  return calculateSummary(records);
}

/**
 * Generate complete export response with metadata, summary, and records
 *
 * @param params - Export parameters
 * @returns Complete export response object
 *
 * @example
 * ```typescript
 * const response = generateCompleteExport({
 *   billingPeriod: 'monthly',
 *   format: 'json',
 *   externalCustomerId: 'cust_123'
 * });
 * ```
 */
export async function generateCompleteExport(
  params: GetUsageExportParams & { format: ExportFormat }
): Promise<UsageExportResponse> {
  const { format, ...queryParams } = params;

  // Query data from database
  const queryResult = await getUsageExportData(queryParams);

  // Generate summary
  const summary = calculateSummary(queryResult.records);

  // Format response
  const response = formatExportResponse({
    records: queryResult.records,
    summary,
    format,
    billingPeriod: params.billingPeriod,
    periodStart: queryResult.periodStart,
    periodEnd: queryResult.periodEnd,
    filters: {
      customerId: params.externalCustomerId || null,
      service: params.service || null,
      licenseNonce: params.licenseNonce || null,
    },
    pagination: queryResult.pagination,
  });

  logger.info('[UsageExport] Complete export generated', {
    format,
    recordCount: queryResult.records.length,
    totalCredits: summary.totalCredits,
  });

  return response;
}

/**
 * Create downloadable file content
 *
 * @param response - Complete export response
 * @param format - Desired output format
 * @returns Object with content, filename, and content type
 */
export function createDownloadableExport(
  response: UsageExportResponse,
  format: ExportFormat
): {
  content: string;
  filename: string;
  contentType: string;
} {
  if (format === 'csv') {
    const csvContent = formatAsCSV(response.records);
    const summaryCSV = formatSummaryAsCSV(response.summary);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    return {
      content: `${csvContent}\r\n\r\n${summaryCSV}`,
      filename: `usage-export-${timestamp}.csv`,
      contentType: 'text/csv',
    };
  }

  return createJSONDownload(response);
}
