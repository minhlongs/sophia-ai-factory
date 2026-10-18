/**
 * CRM Configuration & Webhook Subscription Mutations
 *
 * Layer: land/integrations/actions
 *
 * @module land/integrations/actions/integration-mutations
 */

'use server';

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
import {
  runAdminD1Action,
  validateWebhookEndpointUrl,
} from './integration-mutation-helpers';

/**
 * Configures or updates CRM integration settings for a tenant.
 */
export async function configureCrm(
  input: UpsertCrmConfigInput
): Promise<ActionResult<EnterpriseCrmConfig>> {
  return runAdminD1Action(async (db) => {
    const config = await saveCrmConfig(db, input);
    logger.info('CRM configuration saved', { tenantId: input.tenantId, provider: input.provider });
    return config;
  }, 'Failed to configure CRM');
}

/**
 * Lists all CRM configs for a tenant.
 */
export async function listCrmConfigsAction(
  tenantId: string
): Promise<ActionResult<EnterpriseCrmConfig[]>> {
  return runAdminD1Action((db) => listCrmConfigs(db, tenantId));
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
  return runAdminD1Action(async (db) => {
    validateWebhookEndpointUrl(endpointUrl);
    const subscription = await createWebhookSubscription(db, {
      tenantId,
      endpointUrl,
      secretKey,
      eventTypes,
      description,
      isActive: true,
    });
    logger.info('Webhook subscription created', { tenantId, endpointUrl, subId: subscription.id });
    return subscription;
  }, 'Failed to subscribe webhook');
}

/**
 * Updates an existing webhook subscription.
 */
export async function updateWebhookSubscriptionAction(
  subscriptionId: string,
  updates: UpdateWebhookSubscriptionInput
): Promise<ActionResult<WebhookSubscription>> {
  return runAdminD1Action(async (db) => {
    const updated = await updateWebhookSubscription(db, subscriptionId, updates);
    if (!updated) {
      throw new Error(`Webhook subscription '${subscriptionId}' not found`);
    }
    return updated;
  });
}

/**
 * Lists webhook subscriptions for a tenant.
 */
export async function listWebhookSubscriptionsAction(
  tenantId: string
): Promise<ActionResult<WebhookSubscription[]>> {
  return runAdminD1Action((db) => listWebhookSubscriptions(db, tenantId));
}

/**
 * Lists delivery logs for a subscription or across tenant.
 */
export async function listDeliveryLogs(
  subscriptionId?: string,
  limit = 50
): Promise<ActionResult<WebhookDeliveryLog[]>> {
  return runAdminD1Action((db) => listWebhookDeliveryLogs(db, subscriptionId, limit));
}
