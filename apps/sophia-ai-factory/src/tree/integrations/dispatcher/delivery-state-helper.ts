/**
 * Webhook Delivery State Persistence Helper
 *
 * Layer: tree/integrations
 */

import type { D1Database } from '@/seed/db/client';
import type { WebhookDeliveryStatus } from '../types';
import {
  MAX_DELIVERY_ATTEMPTS,
  calculateNextBackoffDelayMs,
  isRetryableHttpStatus,
} from './backoff-scheduler';

export async function recordSubscriptionSuccess(
  db: D1Database,
  subscriptionId: string,
): Promise<void> {
  await db
    .prepare('UPDATE webhook_subscriptions SET failure_count = 0, last_delivery_at = ? WHERE id = ?')
    .bind(Date.now(), subscriptionId)
    .run();
}

export async function recordSubscriptionFailure(
  db: D1Database,
  subscriptionId: string,
): Promise<void> {
  await db
    .prepare('UPDATE webhook_subscriptions SET failure_count = failure_count + 1 WHERE id = ?')
    .bind(subscriptionId)
    .run();
}

export function resolveRetryOutcome(params: {
  attempt: number;
  httpStatus?: number | null;
  isNetworkError: boolean;
  enableJitter?: boolean;
}): { deliveryStatus: WebhookDeliveryStatus; nextRetryAt: number | null } {
  const { attempt, httpStatus, isNetworkError, enableJitter } = params;
  const retryable =
    isNetworkError || (httpStatus != null && isRetryableHttpStatus(httpStatus));

  if (retryable && attempt < MAX_DELIVERY_ATTEMPTS) {
    const delayMs = calculateNextBackoffDelayMs(attempt + 1, {
      enableJitter: enableJitter ?? true,
    });
    return {
      deliveryStatus: 'retrying',
      nextRetryAt: Date.now() + delayMs,
    };
  }

  return {
    deliveryStatus: 'failed',
    nextRetryAt: null,
  };
}
