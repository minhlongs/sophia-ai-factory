/**
 * D1 raw row types for webhook tables — shared between endpoint and attempt modules.
 * @module lib/webhooks/registry-row-types
 */

export interface EndpointRow {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string;
  active: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
}

export interface AttemptRow {
  id: string;
  endpoint_id: string;
  tenant_id: string;
  event: string;
  payload: string;
  attempt_num: number;
  status: string;
  http_status: number | null;
  response_body: string | null;
  error_message: string | null;
  next_retry_at: string | null;
  created_at: string;
  completed_at: string | null;
}
