/**
 * Webhook Delivery Replay Server Action
 *
 * Layer: land/admin/webhooks
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type { WebhookDelivery } from '@/seed/types/outbound-webhooks';
import { getWebhookEndpointById } from '@/tree/webhooks/subscription-repo';
import { executeWebhookReplay } from '@/tree/webhooks/delivery-service';
import { verifyWebhookAccess } from './access-verifier';
import type { ActionError } from './types';

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
