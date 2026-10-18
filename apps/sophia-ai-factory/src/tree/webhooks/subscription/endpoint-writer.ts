import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  WebhookEndpoint,
  CreateWebhookEndpointInput,
} from '@/seed/types/outbound-webhooks';
import {
  validateWebhookUrl,
  generateEndpointId,
  generateEndpointSecret,
} from './validation';
export {
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
} from './endpoint-mutator';

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
