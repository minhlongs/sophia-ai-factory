/**
 * Partner Webhook HTTP Delivery Attempt Loop
 *
 * Layer: tree/partners/webhook-bus
 *
 * @module tree/partners/webhook-bus/delivery-attempt-runner
 */

import {
  type PartnerWebhookEventType,
  SIGNATURE_HEADER_NAME,
} from './types';
import { calculateBackoffDelayMs, isRetryableHttpStatus } from './backoff-strategy';

export interface WebhookAttemptLoopInput {
  endpointUrl: string;
  eventId: string;
  eventType: PartnerWebhookEventType;
  payloadJson: string;
  headerValue: string;
  maxAttempts: number;
  fetchFn?: typeof fetch;
}

export interface WebhookAttemptLoopResult {
  attempts: number;
  delivered: boolean;
  lastStatus?: number;
  lastError?: string;
}

export async function executeWebhookDeliveryAttempts(
  input: WebhookAttemptLoopInput,
): Promise<WebhookAttemptLoopResult> {
  const fetcher = input.fetchFn ?? fetch;
  let attempts = 0;
  let delivered = false;
  let lastStatus: number | undefined;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= input.maxAttempts; attempt++) {
    attempts = attempt;

    try {
      const response = await fetcher(input.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [SIGNATURE_HEADER_NAME]: input.headerValue,
          'X-Sophia-Event-Type': input.eventType,
          'X-Sophia-Event-Id': input.eventId,
          'X-Sophia-Delivery-Attempt': String(attempt),
        },
        body: input.payloadJson,
      });

      lastStatus = response.status;

      if (response.ok) {
        delivered = true;
        break;
      }

      if (!isRetryableHttpStatus(response.status)) {
        lastError = `Non-retryable HTTP ${response.status}`;
        break;
      }

      lastError = `HTTP ${response.status}`;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < input.maxAttempts) {
      const delay = calculateBackoffDelayMs(attempt + 1, false);
      if (input.fetchFn && delay === 0) {
        // Immediate mock in test execution
      }
    }
  }

  return { attempts, delivered, lastStatus, lastError };
}
