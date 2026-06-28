/**
 * Rollup Utilities - Shared Types and Helpers
 *
 * Common interfaces and utility functions used by both hourly and daily rollup modules.
 */

/**
 * Service breakdown item — metrics per service for a time period
 */
export interface ServiceBreakdownItem {
  service: string;
  requests: number;
  credits: number;
  tokens_input: number;
  tokens_output: number;
  errors: number;
  avg_response_time_ms: number;
}

/**
 * Hourly summary record — aggregated metrics for one tenant per hour
 */
export interface HourlySummaryRecord {
  hourTimestamp: number;
  tenantId: string;
  licenseNonce: string;
  externalCustomerId: string | null;
  totalRequests: number;
  totalCredits: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalErrors: number;
  avgResponseTimeMs: number;
  serviceBreakdown: ServiceBreakdownItem[];
}

/**
 * Daily summary record — aggregated metrics for one tenant per day
 */
export interface DailySummaryRecord {
  dayTimestamp: number;
  tenantId: string;
  licenseNonce: string;
  externalCustomerId: string | null;
  totalRequests: number;
  totalCredits: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalErrors: number;
  avgResponseTimeMs: number;
  hourlyBreakdown: Array<{
    hour: number;
    requests: number;
    credits: number;
    tokensInput: number;
    tokensOutput: number;
    errors: number;
  }>;
  serviceBreakdown: ServiceBreakdownItem[];
}

/**
 * Calculate weighted average response time from sum and request count
 */
export function calcAvgResponseTime(sum: number, requests: number): number {
  return requests > 0 ? Math.round((sum / requests) * 100) / 100 : 0;
}

/**
 * Raw usage event row from Supabase query
 */
export interface UsageEventRow {
  user_id: string;
  license_nonce: string;
  external_customer_id: string | null;
  service_name: string;
  credits_used: number;
  tokens_input: number;
  tokens_output: number;
  status_code: number | null;
  response_time_ms: number | null;
}

/**
 * Hourly summary row from Supabase query
 */
export interface HourlySummaryRow {
  hour_timestamp: number;
  tenant_id: string;
  license_nonce: string;
  external_customer_id: string | null;
  total_requests: number;
  total_credits: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_errors: number;
  avg_response_time_ms: number;
  service_breakdown: unknown;
}
