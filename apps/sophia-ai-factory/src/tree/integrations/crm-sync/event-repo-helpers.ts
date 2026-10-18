/**
 * @file event-repo-helpers.ts
 * @description SQL query builder and ID generation helpers for CRM sync events.
 * @layer tree
 */

import type { CrmSyncStatus } from '../types';

export interface CrmSyncEventUpdates {
  status?: CrmSyncStatus;
  externalId?: string | null;
  errorMessage?: string | null;
  retryCount?: number;
  nextRetryAt?: number | null;
  syncedAt?: number | null;
}

export function generateSyncEventId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function buildCrmSyncEventUpdateSql(
  id: string,
  updates: CrmSyncEventUpdates,
  now: number
): { sql: string; bindings: unknown[] } {
  const parts: string[] = [];
  const bindings: unknown[] = [];

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

  return {
    sql: `UPDATE crm_sync_events SET ${parts.join(', ')} WHERE id = ?`,
    bindings,
  };
}
