/**
 * Usage Metering Types
 *
 * Type definitions for tracking AI service usage
 */

/**
 * Supported AI services
 */
export type AiService = 'heygen' | 'elevenlabs' | 'openrouter';

/**
 * Usage event for tracking
 */
export interface UsageEventInput {
  userId: string;
  licenseKeyHash: string;
  licenseNonce: string;
  service: AiService;
  endpoint: string;
  action: string;
  tokensInput?: number;
  tokensOutput?: number;
  creditsUsed: number;
  requestId?: string;
  modelName?: string;
  tierAtRequest: string;
  statusCode?: number;
  errorMessage?: string;
  responseTimeMs?: number;
  createdAt?: number;
  idempotencyKey?: string;
  externalCustomerId?: string;
  resourceType?: string;
}

/**
 * Database-ready usage event
 */
export interface UsageEventDB {
  user_id: string;
  license_key_hash: string;
  license_nonce: string;
  service_name: string;
  endpoint: string;
  action: string;
  tokens_input: number;
  tokens_output: number;
  credits_used: number;
  request_id: string | null;
  model_name: string | null;
  tier_at_request: string;
  status_code: number | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: number;
  idempotency_key: string | null;
  external_customer_id: string | null;
  resource_type: string | null;
}

/**
 * Usage summary for a period
 */
export interface UsageSummary {
  service_name: string;
  total_requests: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_credits: number;
}

/**
 * Daily usage breakdown
 */
export interface DailyUsage {
  day_timestamp: number;
  service_name: string;
  requests: number;
  credits: number;
}

/**
 * Export options
 */
export interface ExportOptions {
  licenseNonce?: string;
  userId?: string;
  startTimestamp: number;
  endTimestamp: number;
  service?: AiService;
  format: 'json' | 'csv';
}

/**
 * Credit calculation rule
 */
export interface CreditRule {
  type: 'per-call' | 'per-1k-tokens';
  credits?: number;
  creditsPer1k?: number;
}

/**
 * Aggregated usage by time window
 */
export interface AggregatedUsage {
  tenantId: string;           // user_id
  licenseNonce: string;        // license identifier
  featureKey: string;          // service_name + action (e.g., "heygen.createVideo")
  timestamp: number;           // Unix timestamp (hour or day boundary)
  consumedUnits: number;       // credits used
  requestCount: number;        // total API calls
  tokensInput: number;         // total input tokens
  tokensOutput: number;        // total output tokens
  avgResponseTimeMs: number;   // average response time
  errorCount: number;          // failed requests
}

/**
 * Hourly summary aggregation
 */
export interface HourlySummary {
  hourTimestamp: number;       // Start of hour (Unix timestamp)
  serviceBreakdown: AggregatedUsage[];
  totalCredits: number;
  totalRequests: number;
  totalTokens: number;
}

/**
 * Daily summary aggregation
 */
export interface DailySummary {
  dayTimestamp: number;        // Start of day (Unix timestamp)
  hourlyBreakdown: HourlySummary[];
  totalCredits: number;
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
}

/**
 * Quota limit configuration per tier
 */
export interface QuotaLimit {
  tier: string;
  dailyCredits: number;
  hourlyCredits: number;
  dailyRequests: number;
  monthlyCredits: number;
}

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  allowed: boolean;
  remaining: {
    dailyCredits: number;
    hourlyCredits: number;
    dailyRequests: number;
    monthlyCredits: number;
  };
  exceeded?: {
    type: 'daily_credits' | 'hourly_credits' | 'daily_requests' | 'monthly_credits';
    limit: number;
    current: number;
  };
}

/**
 * CSV export row with standardized field names
 */
export interface CsvExportRow {
  tenant_id: string;
  feature_key: string;
  timestamp: number;
  consumed_units: number;
  request_count: number;
  tokens_input: number;
  tokens_output: number;
  license_nonce: string;
  service: string;
  action: string;
  status: 'success' | 'error';
  response_time_ms: number | null;
  external_customer_id?: string | null;
}

/**
 * Batch ingestion record input format
 */
export interface BatchUsageRecord {
  tenant_id: string;
  feature_key: string;
  timestamp: number;
  consumed_units: number;
  request_count: number;
  tokens_input: number;
  tokens_output: number;
  license_nonce: string;
  service: string;
  action: string;
  status: 'success' | 'error';
  response_time_ms: number | null;
}

/**
 * Single record ingestion result
 */
export interface IngestionResult {
  index?: number;
  success: boolean;
  error?: string;
  reason?: 'invalid_license' | 'quota_exceeded' | 'validation_error' | 'duplicate';
  idempotencyKey?: string;
  recordId?: string;
  existingRecordId?: string;
  quotaRemaining?: {
    dailyCredits: number;
    hourlyCredits: number;
    dailyRequests: number;
    monthlyCredits: number;
  };
}

/**
 * Batch ingestion response
 */
export interface BatchIngestionResponse {
  total: number;
  accepted: number;
  rejected: number;
  results: IngestionResult[];
  timestamp: string;
}

/**
 * D1 usage_events insert schema
 */
export interface UsageEventInsertable {
  user_id: string;
  license_key_hash: string;
  license_nonce: string;
  service_name: string;
  endpoint: string;
  action: string;
  tokens_input: number;
  tokens_output: number;
  credits_used: number;
  request_id: string | null;
  model_name: string | null;
  tier_at_request: string;
  status_code: number | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: number;
  idempotency_key: string | null;
  external_customer_id: string | null;
  resource_type: string | null;
}

/**
 * License metadata lookup row (for tracker + route handlers)
 */
export interface LicenseMetadataRow {
  nonce: string;
  tier: string;
  is_revoked: boolean;
  created_by: string;
  metadata: Record<string, unknown> | null;
}

/**
 * API key record row (for batch route handler)
 */
export interface ApiKeyRecord {
  user_id: string;
  license_nonce: string;
  is_active: boolean;
  tier: string | null;
}
