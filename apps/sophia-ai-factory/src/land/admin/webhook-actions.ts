/**
 * Server Actions for Webhook Administration & Replay
 *
 * Provides customer and admin mutation actions for managing outbound webhook
 * subscriptions and replaying failed deliveries from the DLQ.
 *
 * Layer: land/admin (Can import from @/seed and @/tree; NEVER imports from @/forest)
 * Strictly adheres to 4-layer architecture rules.
 *
 * @module land/admin/webhook-actions
 */

'use server';

import type { D1Database } from '@/seed/db/client';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type { OrgRole } from '@/seed/types/rbac-matrix';
import type {
  WebhookEndpoint,
  WebhookDelivery,
  CreateWebhookEndpointInput,
} from '@/seed/types/outbound-webhooks';
import { canConfigureWebhooks } from '@/tree/rbac/permissions';
import {
  createWebhookEndpoint,
  getWebhookEndpointById,
  listWebhookEndpointsByOrg,
  deleteWebhookEndpoint,
  validateWebhookUrl,
} from '@/tree/webhooks/subscription-repo';
import { executeWebhookReplay } from '@/tree/webhooks/delivery-service';

export interface ActionError {
  code: string;
  message: string;
}

export interface CreateWebhookActionInput extends CreateWebhookEndpointInput {
  orgId: string;
}

/**
 * Verifies authorization and returns user's org role.
 */
async function verifyWebhookAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<{ userId: string; role: OrgRole }, ActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  // System admin override
  if ((user as { role?: string }).role === 'admin') {
    return success({ userId: user.id, role: 'owner' });
  }

  const member = await db
    .prepare(
      `SELECT role FROM organization_members WHERE org_id = ?1 AND user_id = ?2
       UNION
       SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2
       LIMIT 1`
    )
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!member) {
    return failure({ code: 'FORBIDDEN', message: 'You are not a member of this organization' });
  }

  const role = member.role as OrgRole;
  if (!canConfigureWebhooks(role)) {
    return failure({
      code: 'INSUFFICIENT_PERMISSIONS',
      message: `Role '${role}' lacks permission 'canConfigureWebhooks'`,
    });
  }

  return success({ userId: user.id, role });
}

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
 * Replays a failed or dead-lettered webhook attempt.
 */
export async function replayWebhookAction(
  orgId: string,
  deliveryId: string,
): Promise<Result<WebhookDelivery, ActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
    }

    const authRes = await verifyWebhookAccess(db, orgId);
    if (!authRes.ok) return authRes;

    const row = await db
      .prepare(`SELECT * FROM webhook_deliveries WHERE id = ?1`)
      .bind(deliveryId)
      .first<WebhookDelivery>();

    if (!row) {
      return failure({
        code: 'DELIVERY_NOT_FOUND',
        message: `DELIVERY_NOT_FOUND: Delivery '${deliveryId}' not found`,
      });
    }

    if (row.org_id !== orgId) {
      return failure({
        code: 'CROSS_TENANT_VIOLATION',
        message: `CROSS_TENANT_VIOLATION: Delivery belongs to another organization`,
      });
    }

    const endpoint = await getWebhookEndpointById(db, row.endpoint_id, orgId);
    if (!endpoint) {
      return failure({
        code: 'ENDPOINT_NOT_FOUND',
        message: `ENDPOINT_NOT_FOUND: Endpoint '${row.endpoint_id}' not found`,
      });
    }

    const replayed = await executeWebhookReplay(db, endpoint, row);
    return success(replayed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[Webhooks:Action] Replay action failed', { deliveryId, error: message });
    return failure({ code: 'REPLAY_ERROR', message });
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
