/**
 * Webhook Delivery Dispatcher Engine
 *
 * Layer: tree/integrations (Pure domain engine — imports only from @/seed and @/tree/)
 * @module tree/integrations/dispatcher/delivery-dispatcher
 */

import type { D1Database } from '@/seed/db/client';
import type {
  WebhookSubscription,
  WebhookDeliveryStatus,
  WebhookDispatchResult,
} from '../types';
import { SIGNATURE_HEADER_NAME, signWebhookPayload } from './crypto-verifier';
import { recordWebhookDeliveryLog } from './delivery-logger';
import {
  recordSubscriptionSuccess,
  recordSubscriptionFailure,
  resolveRetryOutcome,
} from './delivery-state-helper';

export interface DispatchWebhookOptions {
  fetcher?: typeof fetch;
  attemptNumber?: number;
  currentTimeSeconds?: number;
  enableJitter?: boolean;
}

/**
 * Dispatches a webhook event to a subscription endpoint.
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
      signal: AbortSignal.timeout(10_000),
    });

    durationMs = Date.now() - startTime;
    httpStatus = res.status;
    responseBody = await res.text().then((t) => t.slice(0, 2048)).catch(() => null);

    if (res.ok) {
      deliveryStatus = 'success';
      await recordSubscriptionSuccess(db, subscription.id);
    } else {
      const outcome = resolveRetryOutcome({
        attempt,
        httpStatus: res.status,
        isNetworkError: false,
        enableJitter: options.enableJitter,
      });
      deliveryStatus = outcome.deliveryStatus;
      nextRetryAt = outcome.nextRetryAt;
      await recordSubscriptionFailure(db, subscription.id);
    }
  } catch (err: unknown) {
    durationMs = Date.now() - startTime;
    errorMessage = err instanceof Error ? err.message : String(err);

    const outcome = resolveRetryOutcome({
      attempt,
      isNetworkError: true,
      enableJitter: options.enableJitter,
    });
    deliveryStatus = outcome.deliveryStatus;
    nextRetryAt = outcome.nextRetryAt;
    await recordSubscriptionFailure(db, subscription.id);
  }

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
