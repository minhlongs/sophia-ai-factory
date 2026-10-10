/**
 * Outbound webhook delivery bus service combining dispatch, retry, and replay.
 * @module forest/webhooks/bus/delivery-bus-service
 */

import type { D1Database } from '@/seed/db/client';
import type { WebhookDelivery, WebhookEndpointRow } from '@/seed/types/outbound-webhooks';
import { parseWebhookEndpointRow } from '@/tree/webhooks/subscription-repo';
import { assertTenantScope } from '@/forest/tenant/isolation-guard';
import {
  type WebhookFetcher,
  executeWebhookReplay,
} from '@/tree/webhooks/delivery-service';

export { executeWebhookReplay };
export { dispatchWebhookDelivery } from './webhook-dispatcher';
export { processWebhookRetry, processDueWebhookRetries } from './webhook-retry-runner';

/**
 * Executes a manual replay of a dead-lettered or failed delivery.
 */
export async function replayWebhookAttempt(
  db: D1Database,
  orgId: string,
  deliveryId: string,
  customFetcher?: WebhookFetcher,
): Promise<WebhookDelivery> {
  const row = await db
    .prepare(`SELECT * FROM webhook_deliveries WHERE id = ?1`)
    .bind(deliveryId)
    .first<WebhookDelivery>();

  if (!row) throw new Error(`DELIVERY_NOT_FOUND: Delivery '${deliveryId}' not found`);

  assertTenantScope(orgId, row.org_id);

  const endpointRow = await db
    .prepare(`SELECT * FROM webhook_endpoints WHERE id = ?1`)
    .bind(row.endpoint_id)
    .first<WebhookEndpointRow>();

  if (!endpointRow) throw new Error(`ENDPOINT_NOT_FOUND: Endpoint '${row.endpoint_id}' not found`);

  const endpoint = parseWebhookEndpointRow(endpointRow);
  return executeWebhookReplay(db, endpoint, row, customFetcher);
}
