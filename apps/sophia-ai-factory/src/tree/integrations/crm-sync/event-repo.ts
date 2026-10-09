/**
 * @file event-repo.ts
 * @description D1 SQLite persistence operations for CRM sync events.
 * @layer tree
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CrmSyncEvent,
  CrmSyncEventRow,
  RecordCrmSyncEventInput,
  CrmSyncStatus,
} from '../types';
import { mapCrmSyncEventRow } from '../types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * Records a CRM sync event (inbound or outbound).
 */
export async function recordCrmSyncEvent(
  db: D1Database,
  input: RecordCrmSyncEventInput
): Promise<CrmSyncEvent> {
  const id = input.id || generateId('sync');
  const now = Date.now();
  const status = input.status || 'pending';
  const payloadJson = JSON.stringify(input.payload || {});

  const query = `
    INSERT INTO crm_sync_events (
      id, tenant_id, crm_config_id, entity_type, entity_id,
      external_id, direction, status, payload_json, error_message,
      retry_count, next_retry_at, synced_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `;

  await db
    .prepare(query)
    .bind(
      id,
      input.tenantId,
      input.crmConfigId,
      input.entityType,
      input.entityId,
      input.externalId || null,
      input.direction,
      status,
      payloadJson,
      input.errorMessage || null,
      input.retryCount || 0,
      input.nextRetryAt || null,
      input.syncedAt || (status === 'synced' ? now : null),
      now,
      now
    )
    .run();

  const row = await db
    .prepare('SELECT * FROM crm_sync_events WHERE id = ?')
    .bind(id)
    .first<CrmSyncEventRow>();

  if (!row) {
    throw new Error(`Failed to retrieve recorded CRM sync event ${id}`);
  }
  return mapCrmSyncEventRow(row);
}

/**
 * Updates a CRM sync event status and retry metrics.
 */
export async function updateCrmSyncEvent(
  db: D1Database,
  id: string,
  updates: {
    status?: CrmSyncStatus;
    externalId?: string | null;
    errorMessage?: string | null;
    retryCount?: number;
    nextRetryAt?: number | null;
    syncedAt?: number | null;
  }
): Promise<CrmSyncEvent | null> {
  const parts: string[] = [];
  const bindings: unknown[] = [];
  const now = Date.now();

  if (updates.status !== undefined) {
    parts.push('status = ?');
    bindings.push(updates.status);
  }
  if (updates.externalId !== undefined) {
    parts.push('external_id = ?');
    bindings.push(updates.externalId);
  }
  if (updates.errorMessage !== undefined) {
    parts.push('error_message = ?');
    bindings.push(updates.errorMessage);
  }
  if (updates.retryCount !== undefined) {
    parts.push('retry_count = ?');
    bindings.push(updates.retryCount);
  }
  if (updates.nextRetryAt !== undefined) {
    parts.push('next_retry_at = ?');
    bindings.push(updates.nextRetryAt);
  }
  if (updates.syncedAt !== undefined) {
    parts.push('synced_at = ?');
    bindings.push(updates.syncedAt);
  }

  parts.push('updated_at = ?');
  bindings.push(now);

  bindings.push(id);

  await db
    .prepare(`UPDATE crm_sync_events SET ${parts.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run();

  const row = await db
    .prepare('SELECT * FROM crm_sync_events WHERE id = ?')
    .bind(id)
    .first<CrmSyncEventRow>();

  if (!row) return null;
  return mapCrmSyncEventRow(row);
}

/**
 * Lists recent CRM sync events for a tenant.
 */
export async function listCrmSyncEvents(
  db: D1Database,
  tenantId: string,
  limit = 50
): Promise<CrmSyncEvent[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await db
    .prepare('SELECT * FROM crm_sync_events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(tenantId, safeLimit)
    .all<CrmSyncEventRow>();

  return (result.results || []).map(mapCrmSyncEventRow);
}
