import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  WebhookEndpoint,
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
} from '@/seed/types/outbound-webhooks';
import {
  validateWebhookUrl,
  generateEndpointId,
  generateEndpointSecret,
} from './validation';
import { getWebhookEndpointById } from './endpoint-reader';

/**
 * Creates a new webhook endpoint subscription for an organization.
 */
export async function createWebhookEndpoint(
  db: D1Database,
  orgId: string,
  input: CreateWebhookEndpointInput
): Promise<WebhookEndpoint> {
  const cleanOrgId = (orgId || '').trim();
  if (!cleanOrgId) {
    throw new Error('CROSS_TENANT_VIOLATION: Organization ID is required');
  }

  validateWebhookUrl(input.url);

  if (!Array.isArray(input.events) || input.events.length === 0) {
    throw new Error('VALIDATION_ERROR: At least one event subscription is required');
  }

  const id = generateEndpointId();
  const secret = input.secret && input.secret.trim() ? input.secret.trim() : generateEndpointSecret();
  const description = input.description?.trim() ?? '';
  const eventsJson = JSON.stringify(input.events);
  const now = Date.now();

  try {
    await db
      .prepare(
        `INSERT INTO webhook_endpoints
         (id, org_id, url, secret, description, events, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?8)`
      )
      .bind(id, cleanOrgId, input.url.trim(), secret, description, eventsJson, now, now)
      .run();

    logger.info('[webhooks] endpoint created', { endpointId: id, orgId: cleanOrgId });

    return {
      id,
      org_id: cleanOrgId,
      url: input.url.trim(),
      secret,
      description,
      events: input.events,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
  } catch (err) {
    logger.error('[webhooks] create endpoint failed', {
      orgId: cleanOrgId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Updates an existing webhook endpoint with tenant isolation check.
 */
export async function updateWebhookEndpoint(
  db: D1Database,
  orgId: string,
  endpointId: string,
  input: UpdateWebhookEndpointInput
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
  const newDescription = input.description !== undefined ? input.description.trim() : existing.description;
  const newEvents = input.events !== undefined ? input.events : existing.events;
  const newStatus = input.status !== undefined ? input.status : existing.status;
  const now = Date.now();

  await db
    .prepare(
      `UPDATE webhook_endpoints
       SET url = ?1, secret = ?2, description = ?3, events = ?4, status = ?5, updated_at = ?6
       WHERE id = ?7 AND org_id = ?8`
    )
    .bind(
      newUrl,
      newSecret,
      newDescription,
      JSON.stringify(newEvents),
      newStatus,
      now,
      endpointId,
      orgId
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
  endpointId: string
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
