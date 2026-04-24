/** Supported AI services */
export type AiService = 'heygen' | 'elevenlabs' | 'openrouter';

/** Usage event for tracking */
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

/** Database-ready usage event */
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

/** D1 usage_events insert schema */
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
