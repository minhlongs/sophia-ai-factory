/**
 * Webhook Subscription Update & List Operations
 *
 * Layer: tree/integrations
 *
 * @module tree/integrations/dispatcher/subscription-store-mutations
 */

import type { D1Database } from '@/seed/db/client';
import type {
  WebhookSubscription,
  WebhookSubscriptionRow,
  UpdateWebhookSubscriptionInput,
} from '../types';
import { mapWebhookSubscriptionRow } from '../types';
import { getWebhookSubscription } from './subscription-store';

/**
 * Updates an existing webhook subscription.
 */
export async function updateWebhookSubscription(
  db: D1Database,
  id: string,
  input: UpdateWebhookSubscriptionInput,
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
  tenantId: string,
): Promise<WebhookSubscription[]> {
  const result = await db
    .prepare('SELECT * FROM webhook_subscriptions WHERE tenant_id = ? ORDER BY created_at DESC')
    .bind(tenantId)
    .all<WebhookSubscriptionRow>();

  return (result.results || []).map(mapWebhookSubscriptionRow);
}
