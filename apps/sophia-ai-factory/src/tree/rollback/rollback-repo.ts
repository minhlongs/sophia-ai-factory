/**
 * Rollback Logs Repository
 *
 * Persistence for mission rollback audit trail.
 * Layer: tree (domain-specific reusable).
 *
 * @module tree/rollback
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import {
  generateRollbackId,
  mapRollbackRow,
  toErrorCode,
  type RollbackInput,
  type RollbackRecord,
  type RollbackRepoError,
  type RollbackRow,
} from './rollback-repo-types';

export type { RollbackRecord, RollbackInput, RollbackRepoError };

/**
 * Insert a rollback record into D1.
 */
export async function logRollback(
  input: RollbackInput,
): Promise<Result<RollbackRecord, RollbackRepoError>> {
  try {
    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database binding not available' });
    }

    const id = generateRollbackId();
    const now = Math.floor(Date.now() / 1000);

    await d1
      .prepare(
        'INSERT INTO rollback_logs (id, workspace_id, mission_id, agent_run_id, reason, from_status, to_status, triggered_by, rolled_back_at) ' +
          'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
      )
      .bind(
        id,
        input.workspaceId,
        input.missionId ?? null,
        input.agentRunId ?? null,
        input.reason,
        input.fromStatus,
        input.toStatus,
        input.triggeredBy,
        now,
      )
      .run();

    const record: RollbackRecord = {
      id,
      workspaceId: input.workspaceId,
      missionId: input.missionId ?? null,
      agentRunId: input.agentRunId ?? null,
      reason: input.reason,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      triggeredBy: input.triggeredBy,
      rolledBackAt: now,
    };

    return success(record);
  } catch (err) {
    const error = toErrorCode(err);
    logger.error('[RollbackRepo] logRollback failed', {
      error: error.message,
      workspaceId: input.workspaceId,
      missionId: input.missionId,
    });
    return failure(error);
  }
}

/**
 * Fetch rollback history for a given mission.
 * Returns records ordered by rolled_back_at descending (most recent first).
 */
export async function getRollbackHistory(
  missionId: string,
): Promise<Result<RollbackRecord[], RollbackRepoError>> {
  try {
    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database binding not available' });
    }

    const rows = await d1
      .prepare(
        'SELECT id, workspace_id, mission_id, agent_run_id, reason, from_status, to_status, triggered_by, rolled_back_at ' +
          'FROM rollback_logs WHERE mission_id = ?1 ORDER BY rolled_back_at DESC',
      )
      .bind(missionId)
      .all<RollbackRow>();

    const records: RollbackRecord[] = (rows.results ?? []).map(mapRollbackRow);

    return success(records);
  } catch (err) {
    const error = toErrorCode(err);
    logger.error('[RollbackRepo] getRollbackHistory failed', {
      error: error.message,
      missionId,
    });
    return failure(error);
  }
}
