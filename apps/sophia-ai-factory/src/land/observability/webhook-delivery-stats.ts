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

import { getD1 } from '@/seed/db/client';
import {
  mapAttempt,
  type RawAttempt,
  type WebhookAttemptStatus,
  type WebhookAttemptStatusCount,
  type WebhookAttemptRow,
  type WebhookEndpointSummary,
  type WebhookDeliverySnapshot,
} from './webhook-delivery-types';

export type {
  WebhookAttemptStatus,
  WebhookAttemptStatusCount,
  WebhookAttemptRow,
  WebhookEndpointSummary,
  WebhookDeliverySnapshot,
};

/** Aggregate snapshot of webhook delivery health. */
export async function getWebhookDeliverySnapshot(): Promise<WebhookDeliverySnapshot> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

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
