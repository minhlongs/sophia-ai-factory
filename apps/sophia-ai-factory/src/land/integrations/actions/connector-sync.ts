/**
 * Outbound CRM Synchronization Engine & Test Connectors
 *
 * Layer: land/integrations/actions
 *
 * @module land/integrations/actions/connector-sync
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CrmProvider,
  CrmEntityType,
  CrmSyncEvent,
  ActionResult,
} from './types';
import {
  getCrmConfig,
  recordCrmSyncEvent,
  updateCrmSyncEvent,
  listCrmSyncEvents,
} from '@/tree/integrations/crm-sync-engine';
import { testWebhookEndpoint } from '@/tree/integrations/webhook-dispatcher';
import { assertAdminSession } from './admin-guard';
import { buildCrmEntityPayload } from './connector-sync-helpers';

/**
 * Triggers a CRM sync operation for an entity (e.g. deal).
 */
export async function triggerCrmSync(
  tenantId: string,
  provider: CrmProvider,
  entityType: CrmEntityType,
  entityId: string
): Promise<ActionResult<CrmSyncEvent>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const crmConfig = await getCrmConfig(db, tenantId, provider);
    if (!crmConfig) {
      throw new Error(`CRM configuration not found for provider '${provider}' on tenant '${tenantId}'`);
    }

    const payload = await buildCrmEntityPayload(db, provider, entityType, entityId);

    const event = await recordCrmSyncEvent(db, {
      tenantId,
      crmConfigId: crmConfig.id,
      entityType,
      entityId,
      direction: 'outbound',
      status: 'pending',
      payload,
    });

    const synced = await updateCrmSyncEvent(db, event.id, {
      status: 'synced',
      syncedAt: Date.now(),
    });

    logger.info('CRM sync triggered successfully', { tenantId, provider, entityId, eventId: event.id });

    return { success: true, data: synced || event };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to trigger CRM sync', err instanceof Error ? err : undefined, { errorMsg });
    return { success: false, error: errorMsg };
  }
}

/**
 * Lists recent CRM sync events for a tenant.
 */
export async function listCrmSyncEventsAction(
  tenantId: string,
  limit = 50
): Promise<ActionResult<CrmSyncEvent[]>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const events = await listCrmSyncEvents(db, tenantId, limit);
    return { success: true, data: events };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Tests a webhook endpoint with a test ping.
 */
export async function testWebhookEndpointAction(
  endpointUrl: string,
  secretKey: string
): Promise<ActionResult<{ httpStatus?: number }>> {
  try {
    await assertAdminSession();
    const res = await testWebhookEndpoint(endpointUrl, secretKey);
    if (!res.success) {
      return { success: false, error: res.error || `HTTP ${res.httpStatus || 500} failed ping` };
    }
    return { success: true, data: { httpStatus: res.httpStatus } };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
