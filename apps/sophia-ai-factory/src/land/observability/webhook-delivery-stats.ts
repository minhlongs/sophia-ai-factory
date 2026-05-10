/**
 * Webhook delivery observability — endpoint health + recent attempts.
 *
 * Reads `webhook_endpoints` (registered customer URLs) and `webhook_attempts`
 * (each delivery try). Surfaces:
 *   - Endpoint count + active count + currently-unhealthy count (failure_count > 0)
 *   - Attempt totals by status
 *   - 10 most recent failures + 10 most recent successes
 *
 * Used by admin monitor page. Tenant-agnostic (admin scope).
 *
 * @module land/observability/webhook-delivery-stats
 */

import { getD1Raw } from '@/seed/db/client';

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

interface RawAttempt {
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

function mapAttempt(r: RawAttempt): WebhookAttemptRow {
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

/** Aggregate snapshot of webhook delivery health. */
export async function getWebhookDeliverySnapshot(): Promise<WebhookDeliverySnapshot> {
  const db = await getD1Raw();

  const [endpointRow, totalsRes, failuresRes, successesRes] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS total_endpoints,
           SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_endpoints,
           SUM(CASE WHEN failure_count > 0 THEN 1 ELSE 0 END) AS unhealthy_endpoints
         FROM webhook_endpoints`,
      )
      .first<{
        total_endpoints: number;
        active_endpoints: number;
        unhealthy_endpoints: number;
      }>(),
    db
      .prepare(
        `SELECT status, COUNT(*) AS n
         FROM webhook_attempts
         GROUP BY status`,
      )
      .all<{ status: string; n: number }>(),
    db
      .prepare(
        `SELECT id, endpoint_id, tenant_id, event, attempt_num, status,
                http_status, error_message, created_at, completed_at
         FROM webhook_attempts
         WHERE status IN ('failed','dead_letter')
         ORDER BY created_at DESC
         LIMIT 10`,
      )
      .all<RawAttempt>(),
    db
      .prepare(
        `SELECT id, endpoint_id, tenant_id, event, attempt_num, status,
                http_status, error_message, created_at, completed_at
         FROM webhook_attempts
         WHERE status = 'success'
         ORDER BY created_at DESC
         LIMIT 10`,
      )
      .all<RawAttempt>(),
  ]);

  const endpoints: WebhookEndpointSummary = {
    totalEndpoints: Number(endpointRow?.total_endpoints ?? 0),
    activeEndpoints: Number(endpointRow?.active_endpoints ?? 0),
    unhealthyEndpoints: Number(endpointRow?.unhealthy_endpoints ?? 0),
  };

  const attemptTotals: WebhookAttemptStatusCount[] = (totalsRes.results ?? []).map((r) => ({
    status: (r.status as WebhookAttemptStatus) ?? 'pending',
    count: Number(r.n),
  }));

  return {
    endpoints,
    attemptTotals,
    recentFailures: (failuresRes.results ?? []).map(mapAttempt),
    recentSuccesses: (successesRes.results ?? []).map(mapAttempt),
  };
}
