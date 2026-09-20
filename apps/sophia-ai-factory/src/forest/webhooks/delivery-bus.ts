/**
 * Resilient Outbound Webhook Delivery Bus & Retry Engine
 *
 * Implements:
 * - Asynchronous outbound webhook dispatch with event matching
 * - Web Crypto HMAC-SHA256 payload signing (`X-Sophia-Signature`)
 * - Exponential backoff retry queue with jitter
 * - Dead Letter Queue (DLQ) state transition after 5 exhausted attempts
 * - Tenant-isolated manual replay API with replay headers
 *
 * Layer: forest/webhooks (Infrastructure Orchestration)
 * Strictly adheres to 4-layer architecture rules (0 imports from @/land).
 *
 * @module forest/webhooks/delivery-bus
 */

import type { D1Database } from '@/seed/db/client';
import { generateWebhookSignature } from '@/seed/security/hmac-signer';
import { logger } from '@/seed/utils/logger-utility';
import type { WebhookEndpoint, WebhookDelivery, WebhookEndpointRow } from '@/seed/types/outbound-webhooks';
import { calculateBackoffDelay } from '@/tree/webhooks/backoff-calculator';
import { parseWebhookEndpointRow } from '@/tree/webhooks/subscription-repo';
import { assertTenantScope } from '@/forest/tenant/isolation-guard';
import {
  type WebhookFetcher,
  defaultEdgeFetcher,
  executeWebhookReplay,
} from '@/tree/webhooks/delivery-service';

export { executeWebhookReplay };

/**
 * Dispatches an outbound webhook delivery to an active subscriber endpoint.
 */
export async function dispatchWebhookDelivery(
  db: D1Database,
  endpoint: WebhookEndpoint,
  event: string,
  payload: unknown,
  customFetcher?: WebhookFetcher,
): Promise<WebhookDelivery> {
  // 1. Event subscription check (supports explicit events and wildcard '*')
  const subscribed = endpoint.events.includes(event) || endpoint.events.includes('*');
  if (!subscribed) {
    throw new Error(`EVENT_NOT_SUBSCRIBED: Endpoint '${endpoint.id}' is not subscribed to event '${event}'`);
  }

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const now = Date.now();
  const deliveryId = `del_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const signature = await generateWebhookSignature(
    endpoint.secret,
    payloadString,
    Math.floor(now / 1000),
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Sophia-Signature': signature,
    'X-Sophia-Event': event,
    'X-Sophia-Delivery': deliveryId,
  };

  const fetcher = customFetcher ?? defaultEdgeFetcher;
  let deliveryStatus: 'success' | 'failed' | 'dead_letter' = 'success';
  let responseCode = 200;
  let errorMsg: string | null = null;
  let nextAttemptAt = now;

  try {
    const res = await fetcher(endpoint.url, headers, payloadString);
    responseCode = res.status;
    if (!res.ok) {
      deliveryStatus = 'failed';
      errorMsg = `HTTP_${res.status}`;
      nextAttemptAt = now + calculateBackoffDelay(1, true);
    }
  } catch (err) {
    deliveryStatus = 'failed';
    responseCode = 0;
    errorMsg = err instanceof Error ? err.message : String(err);
    nextAttemptAt = now + calculateBackoffDelay(1, true);
  }

  await db
    .prepare(
      `INSERT INTO webhook_deliveries
       (id, endpoint_id, org_id, event, payload, status, attempt_count, max_attempts, next_attempt_at, response_code, error_message, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, 5, ?7, ?8, ?9, ?10, ?11)`
    )
    .bind(
      deliveryId,
      endpoint.id,
      endpoint.org_id,
      event,
      payloadString,
      deliveryStatus,
      nextAttemptAt,
      responseCode,
      errorMsg,
      now,
      now,
    )
    .run();

  logger.info('[Webhook:Dispatch] Delivery dispatched', {
    deliveryId,
    endpointId: endpoint.id,
    event,
    status: deliveryStatus,
    responseCode,
  });

  return {
    id: deliveryId,
    endpoint_id: endpoint.id,
    org_id: endpoint.org_id,
    event,
    payload: payloadString,
    status: deliveryStatus,
    attempt_count: 1,
    max_attempts: 5,
    next_attempt_at: nextAttemptAt,
    response_code: responseCode,
    error_message: errorMsg,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Processes a scheduled retry attempt for a failed webhook delivery.
 * Transitions to 'dead_letter' (DLQ) if attempt reaches or exceeds max_attempts (5).
 */
export async function processWebhookRetry(
  db: D1Database,
  deliveryId: string,
  customFetcher?: WebhookFetcher,
): Promise<WebhookDelivery> {
  const row = await db
    .prepare(`SELECT * FROM webhook_deliveries WHERE id = ?1`)
    .bind(deliveryId)
    .first<WebhookDelivery>();

  if (!row) {
    throw new Error(`DELIVERY_NOT_FOUND: Delivery '${deliveryId}' not found`);
  }

  const endpointRow = await db
    .prepare(`SELECT * FROM webhook_endpoints WHERE id = ?1`)
    .bind(row.endpoint_id)
    .first<WebhookEndpointRow>();

  if (!endpointRow) {
    throw new Error(`ENDPOINT_NOT_FOUND: Endpoint '${row.endpoint_id}' not found`);
  }

  const endpoint = parseWebhookEndpointRow(endpointRow);

  const now = Date.now();
  const nextAttempt = row.attempt_count + 1;
  const signature = await generateWebhookSignature(
    endpoint.secret,
    row.payload,
    Math.floor(now / 1000),
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Sophia-Signature': signature,
    'X-Sophia-Event': row.event,
    'X-Sophia-Delivery': deliveryId,
  };

  const fetcher = customFetcher ?? defaultEdgeFetcher;
  let newStatus: 'success' | 'failed' | 'dead_letter' = 'success';
  let responseCode = 200;
  let errorMsg: string | null = null;
  let nextAttemptAt = now;

  try {
    const res = await fetcher(endpoint.url, headers, row.payload);
    responseCode = res.status;
    if (!res.ok) {
      if (nextAttempt >= row.max_attempts) {
        newStatus = 'dead_letter'; // DLQ transition
      } else {
        newStatus = 'failed';
        nextAttemptAt = now + calculateBackoffDelay(nextAttempt, true);
      }
      errorMsg = `HTTP_${res.status}`;
    }
  } catch (err) {
    if (nextAttempt >= row.max_attempts) {
      newStatus = 'dead_letter'; // DLQ transition
    } else {
      newStatus = 'failed';
      nextAttemptAt = now + calculateBackoffDelay(nextAttempt, true);
    }
    responseCode = 0;
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  await db
    .prepare(
      `UPDATE webhook_deliveries
       SET status = ?1, attempt_count = ?2, next_attempt_at = ?3, response_code = ?4, error_message = ?5, updated_at = ?6
       WHERE id = ?7`
    )
    .bind(newStatus, nextAttempt, nextAttemptAt, responseCode, errorMsg, now, deliveryId)
    .run();

  logger.info('[Webhook:Retry] Retry attempt evaluated', {
    deliveryId,
    attempt: nextAttempt,
    status: newStatus,
    responseCode,
  });

  return {
    ...row,
    status: newStatus,
    attempt_count: nextAttempt,
    next_attempt_at: nextAttemptAt,
    response_code: responseCode,
    error_message: errorMsg,
    updated_at: now,
  };
}

/**
 * Executes a manual replay of a dead-lettered or failed delivery.
 * Enforces strict tenant isolation across organizations.
 */
export async function replayWebhookAttempt(
  db: D1Database,
  orgId: string,
  deliveryId: string,
  customFetcher?: WebhookFetcher,
): Promise<WebhookDelivery> {
  const row = await db
    .prepare(`SELECT * FROM webhook_deliveries WHERE id = ?1`)
    .bind(deliveryId)
    .first<WebhookDelivery>();

  if (!row) {
    throw new Error(`DELIVERY_NOT_FOUND: Delivery '${deliveryId}' not found`);
  }

  // Strict tenant boundary verification (throws /CROSS_TENANT_VIOLATION/)
  assertTenantScope(orgId, row.org_id);

  const endpointRow = await db
    .prepare(`SELECT * FROM webhook_endpoints WHERE id = ?1`)
    .bind(row.endpoint_id)
    .first<WebhookEndpointRow>();

  if (!endpointRow) {
    throw new Error(`ENDPOINT_NOT_FOUND: Endpoint '${row.endpoint_id}' not found`);
  }

  const endpoint = parseWebhookEndpointRow(endpointRow);

  return executeWebhookReplay(db, endpoint, row, customFetcher);
}

/**
 * Sweeps and processes all retryable deliveries currently due in the queue.
 * Suitable for Cloudflare Workers cron triggers.
 */
export async function processDueWebhookRetries(
  db: D1Database,
  batchSize = 50,
): Promise<{ processed: number; succeeded: number; deadLettered: number }> {
  const now = Date.now();
  const query = `
    SELECT id FROM webhook_deliveries
    WHERE status = 'failed' AND next_attempt_at <= ?1
    ORDER BY next_attempt_at ASC
    LIMIT ?2
  `;
  const rows = await db.prepare(query).bind(now, batchSize).all<{ id: string }>();
  const deliveries = rows.results ?? [];

  let succeeded = 0;
  let deadLettered = 0;

  for (const item of deliveries) {
    try {
      const res = await processWebhookRetry(db, item.id);
      if (res.status === 'success') succeeded++;
      if (res.status === 'dead_letter') deadLettered++;
    } catch (err) {
      logger.error('[Webhook:Cron] Error retrying delivery', { id: item.id, error: String(err) });
    }
  }

  return {
    processed: deliveries.length,
    succeeded,
    deadLettered,
  };
}
