/**
 * Outbound webhook retry runner and due delivery processor.
 * @module forest/webhooks/bus/webhook-retry-runner
 */

import type { D1Database } from '@/seed/db/client';
import { generateWebhookSignature } from '@/seed/security/hmac-signer';
import { logger } from '@/seed/utils/logger-utility';
import type { WebhookDelivery, WebhookEndpointRow } from '@/seed/types/outbound-webhooks';
import { parseWebhookEndpointRow } from '@/tree/webhooks/subscription-repo';
import { type WebhookFetcher, defaultEdgeFetcher } from '@/tree/webhooks/delivery-service';
import { DEFAULT_BATCH_SIZE } from './types';
import { evaluateRetryOutcome } from './retry-policy';

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

  if (!row) throw new Error(`DELIVERY_NOT_FOUND: Delivery '${deliveryId}' not found`);

  const endpointRow = await db
    .prepare(`SELECT * FROM webhook_endpoints WHERE id = ?1`)
    .bind(row.endpoint_id)
    .first<WebhookEndpointRow>();

  if (!endpointRow) throw new Error(`ENDPOINT_NOT_FOUND: Endpoint '${row.endpoint_id}' not found`);

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
  let fetchRes: { ok: boolean; status: number } | null = null;
  let fetchErr: unknown | null = null;

  try {
    fetchRes = await fetcher(endpoint.url, headers, row.payload);
  } catch (err) {
    fetchErr = err;
  }

  const outcome = evaluateRetryOutcome(fetchRes, fetchErr, nextAttempt, row.max_attempts, now);

  await db
    .prepare(
      `UPDATE webhook_deliveries
       SET status = ?1, attempt_count = ?2, next_attempt_at = ?3, response_code = ?4, error_message = ?5, updated_at = ?6
       WHERE id = ?7`
    )
    .bind(outcome.status, nextAttempt, outcome.nextAttemptAt, outcome.responseCode, outcome.errorMessage, now, deliveryId)
    .run();

  logger.info('[Webhook:Retry] Retry attempt evaluated', {
    deliveryId,
    attempt: nextAttempt,
    status: outcome.status,
    responseCode: outcome.responseCode,
  });

  return {
    ...row,
    status: outcome.status,
    attempt_count: nextAttempt,
    next_attempt_at: outcome.nextAttemptAt,
    response_code: outcome.responseCode,
    error_message: outcome.errorMessage,
    updated_at: now,
  };
}

/**
 * Sweeps and processes all retryable deliveries currently due in the queue.
 */
export async function processDueWebhookRetries(
  db: D1Database,
  batchSize = DEFAULT_BATCH_SIZE,
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
