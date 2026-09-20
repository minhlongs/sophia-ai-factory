/**
 * Webhook Delivery Core Domain Service
 *
 * Implements the low-level delivery, retry, and manual replay operations.
 * Designed in Layer: tree/webhooks so both Layer: forest (delivery-bus)
 * and Layer: land (admin actions) can access it without circular or layer violations.
 *
 * Layer: tree/webhooks (Domain logic - imports only from @/seed/* and @/tree/*)
 * Strictly adheres to 4-layer architecture rules (0 imports from @/forest or @/land).
 *
 * @module tree/webhooks/delivery-service
 */

import type { D1Database } from '@/seed/db/client';
import { generateWebhookSignature } from '@/seed/security/hmac-signer';
import { logger } from '@/seed/utils/logger-utility';
import type { WebhookEndpoint, WebhookDelivery } from '@/seed/types/outbound-webhooks';

export type WebhookFetcher = (
  url: string,
  headers: Record<string, string>,
  body: string,
) => Promise<{ status: number; ok: boolean }>;

export const defaultEdgeFetcher: WebhookFetcher = async (url, headers, body) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s edge timeout
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    return { status: res.status, ok: res.ok };
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Executes low-level manual replay of a webhook delivery.
 *
 * @param db - D1Database instance
 * @param endpoint - Target WebhookEndpoint
 * @param delivery - Existing WebhookDelivery record to replay
 * @param fetcher - Optional custom fetcher function (defaults to defaultEdgeFetcher)
 * @returns Updated WebhookDelivery record
 */
export async function executeWebhookReplay(
  db: D1Database,
  endpoint: WebhookEndpoint,
  delivery: WebhookDelivery,
  fetcher: WebhookFetcher = defaultEdgeFetcher,
): Promise<WebhookDelivery> {
  const now = Date.now();
  const signature = await generateWebhookSignature(
    endpoint.secret,
    delivery.payload,
    Math.floor(now / 1000),
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Sophia-Signature': signature,
    'X-Sophia-Event': delivery.event,
    'X-Sophia-Delivery': delivery.id,
    'X-Sophia-Replay': 'true',
  };

  let status: 'success' | 'dead_letter' = 'success';
  let responseCode = 200;
  let errorMsg: string | null = null;

  try {
    const res = await fetcher(endpoint.url, headers, delivery.payload);
    responseCode = res.status;
    if (!res.ok) {
      status = 'dead_letter';
      errorMsg = `REPLAY_FAILED_HTTP_${res.status}`;
    }
  } catch (err) {
    status = 'dead_letter';
    responseCode = 0;
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  await db
    .prepare(
      `UPDATE webhook_deliveries
       SET status = ?1, response_code = ?2, error_message = ?3, updated_at = ?4
       WHERE id = ?5`
    )
    .bind(status, responseCode, errorMsg, now, delivery.id)
    .run();

  logger.info('[Webhook:Replay] Manual replay completed', {
    deliveryId: delivery.id,
    status,
    responseCode,
  });

  return {
    ...delivery,
    status,
    response_code: responseCode,
    error_message: errorMsg,
    updated_at: now,
  };
}
