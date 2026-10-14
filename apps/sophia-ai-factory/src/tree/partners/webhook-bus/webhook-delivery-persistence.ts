/**
 * Subscription Lookup and Delivery Log Persistence Helpers for Partner Webhook Dispatcher.
 * @module tree/partners/webhook-bus/webhook-delivery-persistence
 */

import type { D1Database } from '@/seed/db/client';
import type { PartnerWebhookEventType } from './types';

export function generateWebhookEventId(prefix = 'evt'): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export async function resolvePartnerWebhookSubscription(
  db: D1Database | undefined,
  partnerId: string,
  now: number,
  explicitEndpointUrl?: string,
  explicitSecretKey?: string,
): Promise<{ endpointUrl: string; secretKey: string }> {
  let endpointUrl = explicitEndpointUrl;
  let secretKey = explicitSecretKey;

  if ((!endpointUrl || !secretKey) && db) {
    try {
      interface SubRow {
        endpoint_url: string;
        secret_key: string;
      }
      const sub = await db
        .prepare(
          `SELECT endpoint_url, secret_key
           FROM webhook_subscriptions
           WHERE tenant_id = ?1 AND is_active = 1
           LIMIT 1`,
        )
        .bind(partnerId)
        .first<SubRow>();

      if (sub) {
        endpointUrl = endpointUrl || sub.endpoint_url;
        secretKey = secretKey || sub.secret_key;
      }
    } catch {
      // Ignore if table does not exist
    }
  }

  return {
    endpointUrl: endpointUrl || `https://api.partner-mesh.internal/webhooks/${partnerId}`,
    secretKey: secretKey || `whsec_${partnerId}_${now.toString(36)}`,
  };
}

export async function recordWebhookDeliveryLog(params: {
  db: D1Database | undefined;
  partnerId: string;
  eventType: PartnerWebhookEventType;
  payloadJson: string;
  headerValue: string;
  lastStatus: number | undefined;
  delivered: boolean;
  attempts: number;
}): Promise<string | undefined> {
  const { db, partnerId, eventType, payloadJson, headerValue, lastStatus, delivered, attempts } = params;
  if (!db) return undefined;

  try {
    const deliveryLogId = generateWebhookEventId('pwlog');
    await db
      .prepare(
        `INSERT INTO webhook_delivery_logs (
           id, subscription_id, event_type, payload_json, signature,
           http_status, status, attempt_number, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(
        deliveryLogId,
        partnerId,
        eventType,
        payloadJson,
        headerValue,
        lastStatus ?? null,
        delivered ? 'success' : 'failed',
        attempts,
        Date.now(),
      )
      .run();
    return deliveryLogId;
  } catch {
    return undefined;
  }
}
