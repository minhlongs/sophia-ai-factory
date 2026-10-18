/**
 * Partner Webhook Event Bus Dispatcher
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/webhook-bus/dispatcher
 */

import type { D1Database } from '@/seed/db/client';
import {
  type PartnerWebhookEventType,
  type DispatchPartnerWebhookOptions,
  type PartnerWebhookDeliveryResult,
  MAX_DELIVERY_ATTEMPTS,
} from './types';
import { signPartnerWebhookPayload } from './signature-verifier';
import { calculateBackoffDelayMs } from './backoff-strategy';
import {
  generateWebhookEventId,
  resolvePartnerWebhookSubscription,
  recordWebhookDeliveryLog,
} from './webhook-delivery-persistence';
import { executeWebhookDeliveryAttempts } from './delivery-attempt-runner';

/**
 * Dispatches a partner webhook event with Web Crypto HMAC-SHA256 signing
 * and 5-stage exponential backoff retry logic.
 */
export async function dispatchPartnerQuotaWebhook(
  dbOrPartnerId: D1Database | string,
  partnerIdOrEventType: string | PartnerWebhookEventType,
  eventTypeOrPayload: PartnerWebhookEventType | Record<string, unknown>,
  payloadOrOptions?: Record<string, unknown> | DispatchPartnerWebhookOptions,
  maybeOptions?: DispatchPartnerWebhookOptions,
): Promise<PartnerWebhookDeliveryResult> {
  let db: D1Database | undefined;
  let partnerId: string;
  let eventType: PartnerWebhookEventType;
  let payload: Record<string, unknown>;
  let options: DispatchPartnerWebhookOptions | undefined;

  if (typeof dbOrPartnerId !== 'string') {
    db = dbOrPartnerId;
    partnerId = partnerIdOrEventType as string;
    eventType = eventTypeOrPayload as PartnerWebhookEventType;
    payload = (payloadOrOptions as Record<string, unknown>) ?? {};
    options = maybeOptions;
  } else {
    partnerId = dbOrPartnerId;
    eventType = partnerIdOrEventType as PartnerWebhookEventType;
    payload = (eventTypeOrPayload as Record<string, unknown>) ?? {};
    options = payloadOrOptions as DispatchPartnerWebhookOptions | undefined;
    db = options?.db;
  }

  const eventId = generateWebhookEventId('pwevt');
  const now = Math.floor(Date.now() / 1000);

  const { endpointUrl, secretKey } = await resolvePartnerWebhookSubscription(
    db,
    partnerId,
    now,
    options?.endpointUrl,
    options?.secretKey,
  );

  const fullEnvelope = {
    id: eventId,
    event: eventType,
    timestamp: now,
    partner_id: partnerId,
    data: payload,
  };

  const payloadJson = JSON.stringify(fullEnvelope);
  const { headerValue } = await signPartnerWebhookPayload(secretKey, payloadJson, now);

  const maxAttempts = options?.maxAttempts ?? MAX_DELIVERY_ATTEMPTS;

  const { attempts, delivered, lastStatus, lastError } = await executeWebhookDeliveryAttempts({
    endpointUrl,
    eventId,
    eventType,
    payloadJson,
    headerValue,
    maxAttempts,
    fetchFn: options?.fetchFn,
  });

  const deliveryLogId = await recordWebhookDeliveryLog({
    db, partnerId, eventType, payloadJson, headerValue, lastStatus, delivered, attempts,
  });

  const nextRetryDelayMs = (!delivered && attempts < maxAttempts)
    ? calculateBackoffDelayMs(attempts + 1, false)
    : undefined;

  return {
    eventId, partnerId, eventType, delivered,
    httpStatus: lastStatus, attempts, lastError,
    signatureHeader: headerValue, nextRetryDelayMs, deliveryLogId,
  };
}
