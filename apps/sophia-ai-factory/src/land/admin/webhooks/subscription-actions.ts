/**
 * Webhook Endpoint Subscription Server Actions
 *
 * Layer: land/admin/webhooks
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type { WebhookEndpoint } from '@/seed/types/outbound-webhooks';
import {
  createWebhookEndpoint,
  listWebhookEndpointsByOrg,
  deleteWebhookEndpoint,
  validateWebhookUrl,
} from '@/tree/webhooks/subscription-repo';
import { verifyWebhookAccess } from './access-verifier';
import type { ActionError, CreateWebhookActionInput } from './types';

/**
 * Creates a new HTTPS webhook subscription for an organization.
 */
export async function createWebhookEndpointAction(
  input: CreateWebhookActionInput,
): Promise<Result<WebhookEndpoint, ActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
    }

    const authRes = await verifyWebhookAccess(db, input.orgId);
    if (!authRes.ok) return authRes;

    try {
      validateWebhookUrl(input.url);
    } catch (urlErr) {
      return failure({
        code: 'INVALID_WEBHOOK_URL',
        message: urlErr instanceof Error ? urlErr.message : 'INVALID_WEBHOOK_URL: Webhook URL must use HTTPS protocol',
      });
    }

    const endpoint = await createWebhookEndpoint(db, input.orgId, {
      url: input.url,
      secret: input.secret,
      description: input.description,
      events: input.events,
    });

    logger.info('[Webhooks:Action] Webhook endpoint created', {
      endpointId: endpoint.id,
      orgId: input.orgId,
      events: input.events,
    });

    return success(endpoint);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[Webhooks:Action] Endpoint creation failed', { error: message });
    return failure({ code: 'INTERNAL_ERROR', message });
  }
}

/**
 * Lists all registered webhook endpoints for an organization (secrets masked).
 */
export async function listWebhooksAction(
  orgId: string,
): Promise<Result<Omit<WebhookEndpoint, 'secret'>[], ActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
    }

    const authRes = await verifyWebhookAccess(db, orgId);
    if (!authRes.ok) return authRes;

    const endpoints = await listWebhookEndpointsByOrg(db, orgId);
    const masked = endpoints.map((ep) => {
      const { secret: _secret, ...rest } = ep;
      return rest;
    });

    return success(masked);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure({ code: 'LIST_ERROR', message });
  }
}

/**
 * Deletes or disables a webhook endpoint.
 */
export async function deleteWebhookEndpointAction(
  orgId: string,
  endpointId: string,
): Promise<Result<{ deleted: boolean }, ActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
    }

    const authRes = await verifyWebhookAccess(db, orgId);
    if (!authRes.ok) return authRes;

    await deleteWebhookEndpoint(db, orgId, endpointId);
    return success({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure({ code: 'DELETE_ERROR', message });
  }
}
