/**
 * Retry policy, subscription evaluation, and backoff decision engine.
 * @module forest/webhooks/bus/retry-policy
 */

import type { WebhookEndpoint } from '@/seed/types/outbound-webhooks';
import { calculateBackoffDelay } from '@/tree/webhooks/backoff-calculator';

export interface DeliveryOutcome {
  status: 'success' | 'failed' | 'dead_letter';
  responseCode: number;
  errorMessage: string | null;
  nextAttemptAt: number;
}

/** Check if endpoint is subscribed to an event (or wildcard) */
export function isEventSubscribed(endpoint: WebhookEndpoint, event: string): boolean {
  return endpoint.events.includes(event) || endpoint.events.includes('*');
}

/** Evaluate response or error into a typed delivery outcome */
export function evaluateDispatchOutcome(
  res: { ok: boolean; status: number } | null,
  err: unknown | null,
  now: number,
): DeliveryOutcome {
  if (err != null) {
    return {
      status: 'failed',
      responseCode: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
      nextAttemptAt: now + calculateBackoffDelay(1, true),
    };
  }

  if (res && !res.ok) {
    return {
      status: 'failed',
      responseCode: res.status,
      errorMessage: `HTTP_${res.status}`,
      nextAttemptAt: now + calculateBackoffDelay(1, true),
    };
  }

  return {
    status: 'success',
    responseCode: res?.status ?? 200,
    errorMessage: null,
    nextAttemptAt: now,
  };
}

/** Evaluate retry response or error into a typed outcome (with DLQ transition) */
export function evaluateRetryOutcome(
  res: { ok: boolean; status: number } | null,
  err: unknown | null,
  nextAttempt: number,
  maxAttempts: number,
  now: number,
): DeliveryOutcome {
  if (err != null) {
    const isDlq = nextAttempt >= maxAttempts;
    return {
      status: isDlq ? 'dead_letter' : 'failed',
      responseCode: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
      nextAttemptAt: isDlq ? now : now + calculateBackoffDelay(nextAttempt, true),
    };
  }

  if (res && !res.ok) {
    const isDlq = nextAttempt >= maxAttempts;
    return {
      status: isDlq ? 'dead_letter' : 'failed',
      responseCode: res.status,
      errorMessage: `HTTP_${res.status}`,
      nextAttemptAt: isDlq ? now : now + calculateBackoffDelay(nextAttempt, true),
    };
  }

  return {
    status: 'success',
    responseCode: res?.status ?? 200,
    errorMessage: null,
    nextAttemptAt: now,
  };
}
