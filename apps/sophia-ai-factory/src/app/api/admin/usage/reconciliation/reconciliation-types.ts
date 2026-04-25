/** All type definitions for admin usage reconciliation endpoint. */

export interface ReconciliationFilters {
  licenseNonce?: string;
  customerId?: string;
  service?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  limit: number;
  offset: number;
}

export interface SupabaseUsageEvent {
  id: string;
  user_id: string;
  license_nonce: string;
  service_name: string;
  endpoint: string;
  action: string;
  credits_used: number;
  tokens_input: number;
  tokens_output: number;
  status_code: number | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: number;
  idempotency_key: string | null;
  external_customer_id: string | null;
  resource_type: string | null;
}

export interface LicenseInfo {
  nonce: string;
  tier: string;
  polar_customer_id: string | null;
  stripe_customer_id: string | null;
  polar_subscription_id: string | null;
  is_revoked: boolean;
  created_at: string;
  expires_at: number;
}

export interface UsageEventWithStatus extends SupabaseUsageEvent {
  deduplication_status: 'success' | 'duplicate' | 'failed';
  raw_payload: Record<string, unknown>;
}

export interface BillingPeriod {
  period_start: number;
  period_end: number;
  subscription_id?: string;
  tier: string;
  quota_limit: number;
}

export interface ReconciliationComparison {
  recorded_credits: number;
  billed_credits: number;
  discrepancy: number;
  discrepancy_percentage: number;
  status: 'matched' | 'over_billed' | 'under_billed';
}

export interface AnomalyDetected {
  type: 'spike' | 'gap' | 'quota_exceeded' | 'duplicate_detected' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affected_events: string[];
  timestamp: number;
  recommended_action: string;
}

export interface QuotaCompliance {
  tier: string;
  period: 'hourly' | 'daily' | 'monthly';
  limit: number;
  consumed: number;
  compliance_percentage: number;
  exceeded: boolean;
}

export interface ReconciliationResult {
  comparison: ReconciliationComparison | null;
  anomalies: AnomalyDetected[];
  quotaCompliance: QuotaCompliance[];
}

export interface UsageQueryResult {
  events: SupabaseUsageEvent[];
  totalCount: number;
}

/** Parse Unix timestamp from query param string. */
export function parseTimestamp(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value);
  return isNaN(parsed) ? undefined : parsed;
}

/** Parse and clamp limit param (1–1000, default 100). */
export function parseLimit(value: string | null): number {
  const limit = parseInt(value || '100');
  return Math.max(1, Math.min(limit, 1000));
}
