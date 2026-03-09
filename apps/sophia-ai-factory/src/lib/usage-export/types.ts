/**
 * Usage Export Types
 *
 * Type definitions for usage export functionality
 * Aligned with usage_events table schema (src/lib/supabase/types.ts)
 */

import type { UsageEventRow } from '@/lib/supabase/types';

/**
 * Billing period type
 *
 * Defines the time window for usage aggregation
 */
export type BillingPeriod =
  | 'weekly'
  | 'monthly'
  | 'custom';

/**
 * Export format enumeration
 *
 * Supported output formats for usage export
 */
export type ExportFormat = 'json' | 'csv';

/**
 * Usage export request body
 *
 * Request parameters for filtering and formatting usage data
 */
export interface UsageExportRequest {
  /**
   * Billing period filter
   * - weekly: Last 7 days from today
   * - monthly: Current calendar month
   * - custom: Use startDate and endDate
   */
  billingPeriod: BillingPeriod;

  /**
   * Output format for the export
   */
  format: ExportFormat;

  /**
   * Optional external customer ID filter
   * Filters events by customer identifier
   */
  customerId?: string | null;

  /**
   * Optional start date for custom period (Unix timestamp in seconds)
   * Required when billingPeriod is 'custom'
   */
  startDate?: number | null;

  /**
   * Optional end date for custom period (Unix timestamp in seconds)
   * Required when billingPeriod is 'custom'
   */
  endDate?: number | null;

  /**
   * Optional service filter
   * Filter by specific AI service (heygen, elevenlabs, openrouter)
   */
  service?: string | null;

  /**
   * Optional license nonce filter
   * Filter by specific license identifier
   */
  licenseNonce?: string | null;
}

/**
 * Individual usage export record
 *
 * Flattened view of usage event for export purposes
 * Maps directly to usage_events table columns
 */
export interface UsageExportRecord {
  /**
   * Unique record identifier (UUID)
   */
  id: string;

  /**
   * Tenant/customer identifier (user_id)
   */
  tenant_id: string;

  /**
   * Feature/service key (e.g., "heygen.createVideo")
   * Derived from service_name + action
   */
  feature_key: string;

  /**
   * Quantity/consumed units (credits used)
   */
  quantity: number;

  /**
   * Event timestamp (Unix timestamp in seconds)
   */
  timestamp: number;

  /**
   * License nonce identifier
   */
  license_nonce: string;

  /**
   * Service name (heygen, elevenlabs, openrouter)
   */
  service: string;

  /**
   * Action/endpoint called
   */
  action: string;

  /**
   * Input tokens consumed
   */
  tokens_input: number;

  /**
   * Output tokens consumed
   */
  tokens_output: number;

  /**
   * Request count (always 1 for individual records)
   */
  request_count: number;

  /**
   * Event status
   */
  status: 'success' | 'error';

  /**
   * Response time in milliseconds
   */
  response_time_ms: number | null;

  /**
   * External customer reference (optional)
   */
  external_customer_id: string | null;
}

/**
 * Aggregated usage summary
 *
 * High-level metrics for a billing period
 */
export interface UsageExportSummary {
  /**
   * Total number of requests
   */
  totalRequests: number;

  /**
   * Total credits consumed
   */
  totalCredits: number;

  /**
   * Total input tokens
   */
  totalTokensInput: number;

  /**
   * Total output tokens
   */
  totalTokensOutput: number;

  /**
   * Total cost in USD (if applicable)
   */
  totalCostUsd?: number | null;

  /**
   * Breakdown by service
   */
  byService: Record<string, {
    requests: number;
    credits: number;
    tokensInput: number;
    tokensOutput: number;
  }>;

  /**
   * Breakdown by day (Unix timestamp -> daily totals)
   */
  byDay?: Record<number, {
    requests: number;
    credits: number;
  }>;
}

/**
 * Pagination metadata
 *
 * Information about paginated export results
 */
export interface ExportPagination {
  /**
   * Current page number (1-indexed)
   */
  currentPage: number;

  /**
   * Total number of pages
   */
  totalPages: number;

  /**
   * Number of items per page
   */
  pageSize: number;

  /**
   * Total number of records
   */
  totalRecords: number;

  /**
   * Has next page
   */
  hasNextPage: boolean;

  /**
   * Has previous page
   */
  hasPreviousPage: boolean;
}

/**
 * Usage export response
 *
 * Complete response structure for export API
 */
export interface UsageExportResponse {
  /**
   * Export metadata
   */
  metadata: {
    /**
     * Export generation timestamp (ISO 8601)
     */
    exportedAt: string;

    /**
     * Export format
     */
    format: ExportFormat;

    /**
     * Billing period type
     */
    billingPeriod: BillingPeriod;

    /**
     * Period start timestamp (Unix seconds)
     */
    periodStart: number;

    /**
     * Period end timestamp (Unix seconds)
     */
    periodEnd: number;

    /**
     * Applied filters
     */
    filters: {
      customerId?: string | null;
      service?: string | null;
      licenseNonce?: string | null;
    };
  };

  /**
   * Aggregated summary
   */
  summary: UsageExportSummary;

  /**
   * Exported records (empty for CSV downloads)
   */
  records: UsageExportRecord[];

  /**
   * Pagination info (null if not paginated)
   */
  pagination: ExportPagination | null;
}

/**
 * Database row type for usage_events
 *
 * Alias for Supabase generated type
 */
export type UsageEventDatabaseRow = UsageEventRow;

/**
 * Export query parameters (for URL parsing)
 *
 * Type for validating incoming API requests
 */
export interface UsageExportQueryParams {
  /**
   * Start timestamp (Unix seconds)
   */
  start: string;

  /**
   * End timestamp (Unix seconds)
   */
  end: string;

  /**
   * Output format
   */
  format?: ExportFormat;

  /**
   * Service filter
   */
  service?: string;

  /**
   * License nonce filter
   */
  license_nonce?: string;

  /**
   * External customer ID filter
   */
  customer_id?: string;

  /**
   * Page number for pagination
   */
  page?: string;

  /**
   * Page size for pagination
   */
  page_size?: string;
}
