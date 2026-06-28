/**
 * Public API for firing outbound webhook events.
 * Fans out to all active subscriber endpoints for the event + tenant.
 * Records every attempt. Non-blocking when CF execution context is available.
 * @module lib/webhooks/emitter
 */

import { getActiveEndpointsForEvent, recordAttempt, markSuccess, markFailure } from './registry';
import { sendWebhook } from './sender';
import { nextRetryAt, isDeadLetter } from './retry';
import type { WebhookEvent, WebhookPayload } from './types';

/** Minimal CF execution context interface for waitUntil support */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/** Env shape: needs D1 binding to look up endpoints */
interface WebhookEnv {
  DB?: D1Database;
}

/**
 * Emit an event to all subscribed webhook endpoints for a tenant.
 * Fire-and-forget: uses ctx.waitUntil when available so the response
 * is not blocked by delivery.
 */
export function emit(
  env: WebhookEnv,
  event: WebhookEvent,
  data: Record<string, unknown>,
  tenantId: string,
  ctx?: ExecutionContext,
): void {
  const db = env.DB;
  if (!db) return;

  const work = deliverAll(db, event, data, tenantId);

  if (ctx) {
    ctx.waitUntil(work);
  } else {
    // Best-effort — let it run but don't block caller
    work.catch(() => {});
  }
}

async function deliverAll(
  db: D1Database,
  event: WebhookEvent,
  data: Record<string, unknown>,
  tenantId: string,
): Promise<void> {
  const endpoints = await getActiveEndpointsForEvent(db, tenantId, event);
  if (endpoints.length === 0) return;

  const now = new Date().toISOString();
  const payload: WebhookPayload = {
    id: crypto.randomUUID(),
    event,
    tenantId,
    timestamp: now,
    data,
  };

  await Promise.allSettled(
    endpoints.map(endpoint => deliverOne(db, endpoint, event, payload)),
  );
}

async function deliverOne(
  db: D1Database,
  endpoint: { id: string; tenantId: string; url: string; secret: string },
  event: WebhookEvent,
  payload: WebhookPayload,
): Promise<void> {
  const attemptId = crypto.randomUUID();
  const payloadJson = JSON.stringify(payload);

  const result = await sendWebhook(
    { url: endpoint.url, secret: endpoint.secret },
    event,
    payload,
  );

  const completedAt = new Date().toISOString();

  if (result.success) {
    await markSuccess(db, endpoint.id);
    await recordAttempt(db, {
      id: attemptId,
      endpointId: endpoint.id,
      tenantId: endpoint.tenantId,
      event,
      payload: payloadJson,
      attemptNum: 1,
      status: 'success',
      httpStatus: result.httpStatus,
      responseBody: result.responseBody,
      completedAt,
    });
  } else {
    await markFailure(db, endpoint.id);
    const retryTs = nextRetryAt(1);
    const status = isDeadLetter(1) ? 'dead_letter' : 'failed';

    await recordAttempt(db, {
      id: attemptId,
      endpointId: endpoint.id,
      tenantId: endpoint.tenantId,
      event,
      payload: payloadJson,
      attemptNum: 1,
      status,
      httpStatus: result.httpStatus,
      responseBody: result.responseBody,
      errorMessage: result.error,
      nextRetryAt: retryTs ?? undefined,
      completedAt: status === 'dead_letter' ? completedAt : undefined,
    });
  }
}
