/** CSV export row with standardized field names */
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

/** Batch ingestion record input format */
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

/** Single record ingestion result */
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

/** Batch ingestion response */
export interface BatchIngestionResponse {
  total: number;
  accepted: number;
  rejected: number;
  results: IngestionResult[];
  timestamp: string;
}

/** License metadata lookup row (for tracker + route handlers) */
export interface LicenseMetadataRow {
  nonce: string;
  tier: string;
  is_revoked: boolean;
  created_by: string;
  metadata: Record<string, unknown> | null;
}

/** API key record row (for batch route handler) */
export interface ApiKeyRecord {
  user_id: string;
  license_nonce: string;
  is_active: boolean;
  tier: string | null;
}
