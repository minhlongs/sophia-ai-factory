/**
 * Webhook Delivery Dispatcher Engine
 *
 * Implements:
 * - HTTP POST dispatch with HMAC-SHA256 signing headers.
 * - Delivery log audit recording in D1.
 * - Automatic exponential backoff scheduling upon retryable errors.
 *
 * Layer: tree/integrations (Pure domain engine — imports only from @/seed and @/tree/)
 *
 * @module tree/integrations/dispatcher/delivery-dispatcher
 */

import type { D1Database } from '@/seed/db/client';
import type {
  WebhookSubscription,
  WebhookDeliveryStatus,
  WebhookDispatchResult,
} from '../types';
import { SIGNATURE_HEADER_NAME, signWebhookPayload } from './crypto-verifier';
import {
  MAX_DELIVERY_ATTEMPTS,
  calculateNextBackoffDelayMs,
  isRetryableHttpStatus,
} from './backoff-scheduler';
import { recordWebhookDeliveryLog } from './delivery-logger';

export interface DispatchWebhookOptions {
  fetcher?: typeof fetch;
  attemptNumber?: number;
  currentTimeSeconds?: number;
  enableJitter?: boolean;
}

/**
 * Dispatches a webhook event to a subscription endpoint.
 * Signs payload with HMAC-SHA256, executes HTTP POST, records delivery log,
 * and schedules exponential backoff retry on retryable failure.
 */
export async function dispatchWebhookEvent(
  db: D1Database,
  subscription: WebhookSubscription,
  eventType: string,
  payload: Record<string, unknown>,
  options: DispatchWebhookOptions = {}
): Promise<WebhookDispatchResult> {
  const fetchFn = options.fetcher || globalThis.fetch;
  const attempt = options.attemptNumber ?? 1;
  const payloadJson = JSON.stringify(payload);

  // 1. Sign payload with HMAC-SHA256
  const signResult = await signWebhookPayload(
    subscription.secretKey,
    payloadJson,
    options.currentTimeSeconds
  );

  let httpStatus: number | null = null;
  let responseBody: string | null = null;
  let durationMs = 0;
  let deliveryStatus: WebhookDeliveryStatus = 'failed';
  let nextRetryAt: number | null = null;
  let errorMessage: string | null = null;

  const startTime = Date.now();

  try {
    const res = await fetchFn(subscription.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sophia-Webhook-Dispatcher/2.0',
        [SIGNATURE_HEADER_NAME]: signResult.signatureHeader,
        'X-Sophia-Event': eventType,
        'X-Sophia-Attempt': String(attempt),
      },
      body: payloadJson,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    durationMs = Date.now() - startTime;
    httpStatus = res.status;

    try {
      responseBody = (await res.text()).slice(0, 2048);
    } catch {
      responseBody = null;
    }

    if (res.ok) {
      // HTTP 2xx Success
      deliveryStatus = 'success';
      nextRetryAt = null;

      // Update subscription stats: reset failure count, set last delivery
      await db
        .prepare('UPDATE webhook_subscriptions SET failure_count = 0, last_delivery_at = ? WHERE id = ?')
        .bind(Date.now(), subscription.id)
        .run();
    } else {
      // HTTP Error
      if (isRetryableHttpStatus(res.status) && attempt < MAX_DELIVERY_ATTEMPTS) {
        deliveryStatus = 'retrying';
        const delayMs = calculateNextBackoffDelayMs(attempt + 1, {
          enableJitter: options.enableJitter ?? true,
        });
        nextRetryAt = Date.now() + delayMs;
      } else {
        // Fatal non-retryable 4xx or reached max attempts
        deliveryStatus = 'failed';
        nextRetryAt = null;
      }

      await db
        .prepare('UPDATE webhook_subscriptions SET failure_count = failure_count + 1 WHERE id = ?')
        .bind(subscription.id)
        .run();
    }
  } catch (err: unknown) {
    durationMs = Date.now() - startTime;
    errorMessage = err instanceof Error ? err.message : String(err);

    // Network / timeout error is retryable
    if (attempt < MAX_DELIVERY_ATTEMPTS) {
      deliveryStatus = 'retrying';
      const delayMs = calculateNextBackoffDelayMs(attempt + 1, {
        enableJitter: options.enableJitter ?? true,
      });
      nextRetryAt = Date.now() + delayMs;
    } else {
      deliveryStatus = 'failed';
      nextRetryAt = null;
    }

    await db
      .prepare('UPDATE webhook_subscriptions SET failure_count = failure_count + 1 WHERE id = ?')
      .bind(subscription.id)
      .run();
  }

  // Record delivery log
  const log = await recordWebhookDeliveryLog(db, {
    subscriptionId: subscription.id,
    eventType,
    payload,
    signature: signResult.signatureHeader,
    httpStatus,
    responseBody,
    durationMs,
    status: deliveryStatus,
    attemptNumber: attempt,
    createdAt: Date.now(),
  });

  return {
    deliveryId: log.id,
    subscriptionId: subscription.id,
    eventType,
    status: deliveryStatus,
    httpStatus,
    responseBody,
    durationMs,
    attemptNumber: attempt,
    nextRetryAt,
    signature: signResult.signatureHeader,
    errorMessage,
  };
}
