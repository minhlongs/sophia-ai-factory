/**
 * Webhook Subscription Persistence Store
 *
 * Implements D1 CRUD operations for webhook subscriptions.
 *
 * Layer: tree/integrations (Pure domain engine — imports only from @/seed and @/tree/)
 *
 * @module tree/integrations/dispatcher/subscription-store
 */

import type { D1Database } from '@/seed/db/client';
import type {
  WebhookSubscription,
  WebhookSubscriptionRow,
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
} from '../types';
import { mapWebhookSubscriptionRow } from '../types';

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * Creates a new webhook subscription.
 */
export async function createWebhookSubscription(
  db: D1Database,
  input: CreateWebhookSubscriptionInput
): Promise<WebhookSubscription> {
  const id = input.id || generateId('whsub');
  const secretKey = input.secretKey || `whsec_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Date.now();
  const isActiveNum = input.isActive === false ? 0 : 1;
  const eventTypesJson = JSON.stringify(input.eventTypes || []);

  const query = `
    INSERT INTO webhook_subscriptions (
      id, tenant_id, endpoint_url, secret_key, event_types,
      is_active, description, failure_count, last_delivery_at,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, 0, NULL,
      ?, ?
    )
  `;

  await db
    .prepare(query)
    .bind(
      id,
      input.tenantId,
      input.endpointUrl.trim(),
      secretKey,
      eventTypesJson,
      isActiveNum,
      input.description?.trim() || null,
      now,
      now
    )
    .run();

  const created = await getWebhookSubscription(db, id);
  if (!created) {
    throw new Error(`Failed to retrieve newly created webhook subscription ${id}`);
  }
  return created;
}

/**
 * Retrieves a webhook subscription by ID.
 */
export async function getWebhookSubscription(
  db: D1Database,
  id: string
): Promise<WebhookSubscription | null> {
  const row = await db
    .prepare('SELECT * FROM webhook_subscriptions WHERE id = ?')
    .bind(id)
    .first<WebhookSubscriptionRow>();

  if (!row) return null;
  return mapWebhookSubscriptionRow(row);
}

/**
 * Updates an existing webhook subscription.
 */
export async function updateWebhookSubscription(
  db: D1Database,
  id: string,
  input: UpdateWebhookSubscriptionInput
): Promise<WebhookSubscription | null> {
  const parts: string[] = [];
  const bindings: unknown[] = [];
  const now = Date.now();

  if (input.endpointUrl !== undefined) {
    parts.push('endpoint_url = ?');
    bindings.push(input.endpointUrl.trim());
  }
  if (input.secretKey !== undefined) {
    parts.push('secret_key = ?');
    bindings.push(input.secretKey.trim());
  }
  if (input.eventTypes !== undefined) {
    parts.push('event_types = ?');
    bindings.push(JSON.stringify(input.eventTypes));
  }
  if (input.isActive !== undefined) {
    parts.push('is_active = ?');
    bindings.push(input.isActive ? 1 : 0);
  }
  if (input.description !== undefined) {
    parts.push('description = ?');
    bindings.push(input.description?.trim() || null);
  }

  parts.push('updated_at = ?');
  bindings.push(now);

  bindings.push(id);

  await db
    .prepare(`UPDATE webhook_subscriptions SET ${parts.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run();

  return getWebhookSubscription(db, id);
}

/**
 * Lists webhook subscriptions for a tenant.
 */
export async function listWebhookSubscriptions(
  db: D1Database,
  tenantId: string
): Promise<WebhookSubscription[]> {
  const result = await db
    .prepare('SELECT * FROM webhook_subscriptions WHERE tenant_id = ? ORDER BY created_at DESC')
    .bind(tenantId)
    .all<WebhookSubscriptionRow>();

  return (result.results || []).map(mapWebhookSubscriptionRow);
}
