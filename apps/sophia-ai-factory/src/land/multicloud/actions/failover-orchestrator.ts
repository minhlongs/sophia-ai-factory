/**
 * Failover audit logging & storage replica sync
 * @module land/multicloud/actions/failover-orchestrator
 */

import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { recordReplicationSync } from '@/tree/multicloud/zero-egress-mesh';
import {
  type CloudFailoverAuditLog,
  type CloudFailoverAuditLogRow,
  type ReplicationSyncInput,
  type MulticloudActionError,
  mapRowToFailoverAuditLog,
} from './types';

export async function executeAuditLogsQuery(
  db: D1Database,
  options?: { limit?: number; triggerReason?: string },
): Promise<Result<CloudFailoverAuditLog[], MulticloudActionError>> {
  try {
    let query = 'SELECT * FROM cloud_failover_audit_log WHERE 1=1';
    const params: unknown[] = [];

    if (options?.triggerReason) {
      params.push(options.triggerReason);
      query += ` AND trigger_reason = ?${params.length}`;
    }

    const limit = options?.limit ?? 50;
    params.push(limit);
    query += ` ORDER BY occurred_at DESC LIMIT ?${params.length}`;

    const { results } = await db.prepare(query).bind(...params).all<CloudFailoverAuditLogRow>();
    const logs = (results ?? []).map(mapRowToFailoverAuditLog);

    return success(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] getFailoverAuditLogsAction failed', { error: message });
    return failure({ code: 'AUDIT_QUERY_ERROR', message });
  }
}

export async function executeReplicationSync(
  db: D1Database,
  input: ReplicationSyncInput,
): Promise<Result<{ success: boolean; lagMs: number; verified: boolean }, MulticloudActionError>> {
  try {
    if (!input.assetKey || !input.sourcePoolKey || !input.targetPoolKey || !input.sha256Hash) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'assetKey, sourcePoolKey, targetPoolKey, and sha256Hash are required.',
      });
    }

    const syncResult = await recordReplicationSync(db, input);
    return success(syncResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] syncStoragePoolReplicaAction failed', { error: message });
    return failure({ code: 'REPLICATION_SYNC_ERROR', message });
  }
}
