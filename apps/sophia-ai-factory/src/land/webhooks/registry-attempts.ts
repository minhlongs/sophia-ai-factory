/**
 * D1 CRUD for webhook_attempts table.
 * @module lib/webhooks/registry-attempts
 */

import type { WebhookAttempt, WebhookEvent, AttemptStatus } from './types';
import type { AttemptRow } from './registry-row-types';

function rowToAttempt(row: AttemptRow): WebhookAttempt {
  return {
    id: row.id,
    endpointId: row.endpoint_id,
    tenantId: row.tenant_id,
    event: row.event as WebhookEvent,
    payload: row.payload,
    attemptNum: row.attempt_num,
    status: row.status as AttemptStatus,
    httpStatus: row.http_status ?? undefined,
    responseBody: row.response_body ?? undefined,
    errorMessage: row.error_message ?? undefined,
    nextRetryAt: row.next_retry_at ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

export async function recordAttempt(
  db: D1Database,
  attempt: Omit<WebhookAttempt, 'createdAt'>,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO webhook_attempts
       (id, endpoint_id, tenant_id, event, payload, attempt_num, status, http_status,
        response_body, error_message, next_retry_at, created_at, completed_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`,
    )
    .bind(
      attempt.id,
      attempt.endpointId,
      attempt.tenantId,
      attempt.event,
      attempt.payload,
      attempt.attemptNum,
      attempt.status,
      attempt.httpStatus ?? null,
      attempt.responseBody ?? null,
      attempt.errorMessage ?? null,
      attempt.nextRetryAt ?? null,
      now,
      attempt.completedAt ?? null,
    )
    .run();
}

export async function listAttempts(
  db: D1Database,
  endpointId: string,
  limit = 50,
): Promise<WebhookAttempt[]> {
  const result = await db
    .prepare(
      `SELECT * FROM webhook_attempts WHERE endpoint_id = ?1
       ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(endpointId, limit)
    .all<AttemptRow>();
  return (result.results ?? []).map(rowToAttempt);
}
