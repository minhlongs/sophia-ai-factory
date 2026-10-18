import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  WebhookEndpoint,
  UpdateWebhookEndpointInput,
} from '@/seed/types/outbound-webhooks';
import { validateWebhookUrl } from './validation';
import { getWebhookEndpointById } from './endpoint-reader';

/**
 * Updates an existing webhook endpoint with tenant isolation check.
 */
export async function updateWebhookEndpoint(
  db: D1Database,
  orgId: string,
  endpointId: string,
  input: UpdateWebhookEndpointInput,
): Promise<WebhookEndpoint> {
  const existing = await getWebhookEndpointById(db, endpointId, orgId);
  if (!existing) {
    throw new Error(`ENDPOINT_NOT_FOUND: Endpoint '${endpointId}' not found`);
  }

  if (input.url !== undefined) {
    validateWebhookUrl(input.url);
  }

  const newUrl = input.url !== undefined ? input.url.trim() : existing.url;
  const newSecret = input.secret !== undefined ? input.secret.trim() : existing.secret;
  const newDescription =
    input.description !== undefined ? input.description.trim() : existing.description;
  const newEvents = input.events !== undefined ? input.events : existing.events;
  const newStatus = input.status !== undefined ? input.status : existing.status;
  const now = Date.now();

  await db
    .prepare(
      `UPDATE webhook_endpoints
       SET url = ?1, secret = ?2, description = ?3, events = ?4, status = ?5, updated_at = ?6
       WHERE id = ?7 AND org_id = ?8`,
    )
    .bind(
      newUrl,
      newSecret,
      newDescription,
      JSON.stringify(newEvents),
      newStatus,
      now,
      endpointId,
      orgId,
    )
    .run();

  return {
    ...existing,
    url: newUrl,
    secret: newSecret,
    description: newDescription,
    events: newEvents,
    status: newStatus,
    updated_at: now,
  };
}

/**
 * Deletes a webhook endpoint with tenant isolation verification.
 */
export async function deleteWebhookEndpoint(
  db: D1Database,
  orgId: string,
  endpointId: string,
): Promise<boolean> {
  const existing = await getWebhookEndpointById(db, endpointId, orgId);
  if (!existing) {
    throw new Error(`ENDPOINT_NOT_FOUND: Endpoint '${endpointId}' not found`);
  }

  await db
    .prepare(`DELETE FROM webhook_endpoints WHERE id = ?1 AND org_id = ?2`)
    .bind(endpointId, orgId)
    .run();

  logger.info('[webhooks] endpoint deleted', { endpointId, orgId });
  return true;
}
