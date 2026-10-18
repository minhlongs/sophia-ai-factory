/**
 * Webhook delivery observability types and row mapper.
 * @module land/observability/webhook-delivery-types
 */

export type WebhookAttemptStatus = 'pending' | 'success' | 'failed' | 'dead_letter';

export interface WebhookAttemptStatusCount {
  status: WebhookAttemptStatus;
  count: number;
}

export interface WebhookAttemptRow {
  id: string;
  endpointId: string;
  tenantId: string;
  event: string;
  attemptNum: number;
  status: WebhookAttemptStatus;
  httpStatus: number | null;
  errorMessage: string | null;
  /** ISO timestamp string (sqlite CURRENT_TIMESTAMP). */
  createdAt: string;
  completedAt: string | null;
}

export interface WebhookEndpointSummary {
  totalEndpoints: number;
  activeEndpoints: number;
  /** Endpoints with at least 1 historical failure (failure_count > 0). */
  unhealthyEndpoints: number;
}

export interface WebhookDeliverySnapshot {
  endpoints: WebhookEndpointSummary;
  attemptTotals: WebhookAttemptStatusCount[];
  recentFailures: WebhookAttemptRow[];
  recentSuccesses: WebhookAttemptRow[];
}

export interface RawAttempt {
  id: string;
  endpoint_id: string;
  tenant_id: string;
  event: string;
  attempt_num: number;
  status: string;
  http_status: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function mapAttempt(r: RawAttempt): WebhookAttemptRow {
  return {
    id: r.id,
    endpointId: r.endpoint_id,
    tenantId: r.tenant_id,
    event: r.event,
    attemptNum: Number(r.attempt_num ?? 0),
    status: (r.status as WebhookAttemptStatus) ?? 'pending',
    httpStatus: r.http_status !== null ? Number(r.http_status) : null,
    errorMessage: r.error_message,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}
