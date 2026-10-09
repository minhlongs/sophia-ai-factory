/**
 * Webhook Delivery Audit Logger
 *
 * Implements D1 persistence for webhook delivery attempt logs.
 *
 * Layer: tree/integrations (Pure domain engine — imports only from @/seed and @/tree/)
 *
 * @module tree/integrations/dispatcher/delivery-logger
 */

import type { D1Database } from '@/seed/db/client';
import type {
  WebhookDeliveryLog,
  WebhookDeliveryLogRow,
  WebhookDeliveryStatus,
} from '../types';
import { mapWebhookDeliveryLogRow } from '../types';
import { generateId } from './subscription-store';

/**
 * Records a delivery log entry in D1.
 */
export async function recordWebhookDeliveryLog(
  db: D1Database,
  log: {
    id?: string;
    subscriptionId: string;
    eventType: string;
    payload: Record<string, unknown>;
    signature: string;
    httpStatus: number | null;
    responseBody: string | null;
    durationMs: number | null;
    status: WebhookDeliveryStatus;
    attemptNumber: number;
    createdAt?: number;
  }
): Promise<WebhookDeliveryLog> {
  const id = log.id || generateId('whlog');
  const now = log.createdAt || Date.now();
  const payloadJson = JSON.stringify(log.payload || {});

  const query = `
    INSERT INTO webhook_delivery_logs (
      id, subscription_id, event_type, payload_json, signature,
      http_status, response_body, duration_ms, status, attempt_number,
      created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?
    )
  `;

  await db
    .prepare(query)
    .bind(
      id,
      log.subscriptionId,
      log.eventType,
      payloadJson,
      log.signature,
      log.httpStatus,
      log.responseBody,
      log.durationMs,
      log.status,
      log.attemptNumber,
      now
    )
    .run();

  const row = await db
    .prepare('SELECT * FROM webhook_delivery_logs WHERE id = ?')
    .bind(id)
    .first<WebhookDeliveryLogRow>();

  if (!row) {
    throw new Error(`Failed to retrieve recorded webhook delivery log ${id}`);
  }
  return mapWebhookDeliveryLogRow(row);
}

/**
 * Lists webhook delivery logs for a subscription or all subscriptions.
 */
export async function listWebhookDeliveryLogs(
  db: D1Database,
  subscriptionId?: string,
  limit = 50
): Promise<WebhookDeliveryLog[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));

  let query = 'SELECT * FROM webhook_delivery_logs';
  const bindings: unknown[] = [];

  if (subscriptionId) {
    query += ' WHERE subscription_id = ?';
    bindings.push(subscriptionId);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(safeLimit);

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<WebhookDeliveryLogRow>();

  return (result.results || []).map(mapWebhookDeliveryLogRow);
}
