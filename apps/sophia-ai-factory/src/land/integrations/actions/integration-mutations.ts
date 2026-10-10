/**
 * CRM Configuration & Webhook Subscription Mutations
 *
 * Layer: land/integrations/actions
 *
 * @module land/integrations/actions/integration-mutations
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseCrmConfig,
  UpsertCrmConfigInput,
  WebhookSubscription,
  UpdateWebhookSubscriptionInput,
  WebhookDeliveryLog,
  ActionResult,
} from './types';
import {
  saveCrmConfig,
  listCrmConfigs,
} from '@/tree/integrations/crm-sync-engine';
import {
  createWebhookSubscription,
  updateWebhookSubscription,
  listWebhookSubscriptions,
  listWebhookDeliveryLogs,
} from '@/tree/integrations/webhook-dispatcher';
import { assertAdminSession } from './admin-guard';

/**
 * Configures or updates CRM integration settings for a tenant.
 */
export async function configureCrm(
  input: UpsertCrmConfigInput
): Promise<ActionResult<EnterpriseCrmConfig>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const config = await saveCrmConfig(db, input);
    logger.info('CRM configuration saved', { tenantId: input.tenantId, provider: input.provider });

    return { success: true, data: config };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to configure CRM', err instanceof Error ? err : undefined, { errorMsg });
    return { success: false, error: errorMsg };
  }
}

/**
 * Lists all CRM configs for a tenant.
 */
export async function listCrmConfigsAction(
  tenantId: string
): Promise<ActionResult<EnterpriseCrmConfig[]>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const configs = await listCrmConfigs(db, tenantId);
    return { success: true, data: configs };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Creates a new webhook subscription.
 */
export async function subscribeWebhook(
  tenantId: string,
  endpointUrl: string,
  secretKey: string,
  eventTypes: string[],
  description?: string
): Promise<ActionResult<WebhookSubscription>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    if (!endpointUrl || !endpointUrl.startsWith('http')) {
      throw new Error('INVALID_URL: Webhook endpoint URL must start with http:// or https://');
    }

    const subscription = await createWebhookSubscription(db, {
      tenantId,
      endpointUrl,
      secretKey,
      eventTypes,
      description,
      isActive: true,
    });

    logger.info('Webhook subscription created', { tenantId, endpointUrl, subId: subscription.id });
    return { success: true, data: subscription };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to subscribe webhook', err instanceof Error ? err : undefined, { errorMsg });
    return { success: false, error: errorMsg };
  }
}

/**
 * Updates an existing webhook subscription.
 */
export async function updateWebhookSubscriptionAction(
  subscriptionId: string,
  updates: UpdateWebhookSubscriptionInput
): Promise<ActionResult<WebhookSubscription>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const updated = await updateWebhookSubscription(db, subscriptionId, updates);
    if (!updated) {
      throw new Error(`Webhook subscription '${subscriptionId}' not found`);
    }

    return { success: true, data: updated };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Lists webhook subscriptions for a tenant.
 */
export async function listWebhookSubscriptionsAction(
  tenantId: string
): Promise<ActionResult<WebhookSubscription[]>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const subs = await listWebhookSubscriptions(db, tenantId);
    return { success: true, data: subs };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Lists delivery logs for a subscription or across tenant.
 */
export async function listDeliveryLogs(
  subscriptionId?: string,
  limit = 50
): Promise<ActionResult<WebhookDeliveryLog[]>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const logs = await listWebhookDeliveryLogs(db, subscriptionId, limit);
    return { success: true, data: logs };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
