/**
 * Outbound webhook dispatcher sending HTTP payloads to endpoints.
 * @module forest/webhooks/bus/webhook-dispatcher
 */

import type { D1Database } from '@/seed/db/client';
import { generateWebhookSignature } from '@/seed/security/hmac-signer';
import { logger } from '@/seed/utils/logger-utility';
import type { WebhookEndpoint, WebhookDelivery } from '@/seed/types/outbound-webhooks';
import { type WebhookFetcher, defaultEdgeFetcher } from '@/tree/webhooks/delivery-service';
import { isEventSubscribed, evaluateDispatchOutcome } from './retry-policy';

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
  if (!isEventSubscribed(endpoint, event)) {
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
  let fetchRes: { ok: boolean; status: number } | null = null;
  let fetchErr: unknown | null = null;

  try {
    fetchRes = await fetcher(endpoint.url, headers, payloadString);
  } catch (err) {
    fetchErr = err;
  }

  const outcome = evaluateDispatchOutcome(fetchRes, fetchErr, now);

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
      outcome.status,
      outcome.nextAttemptAt,
      outcome.responseCode,
      outcome.errorMessage,
      now,
      now,
    )
    .run();

  logger.info('[Webhook:Dispatch] Delivery dispatched', {
    deliveryId,
    endpointId: endpoint.id,
    event,
    status: outcome.status,
    responseCode: outcome.responseCode,
  });

  return {
    id: deliveryId,
    endpoint_id: endpoint.id,
    org_id: endpoint.org_id,
    event,
    payload: payloadString,
    status: outcome.status,
    attempt_count: 1,
    max_attempts: 5,
    next_attempt_at: outcome.nextAttemptAt,
    response_code: outcome.responseCode,
    error_message: outcome.errorMessage,
    created_at: now,
    updated_at: now,
  };
}
