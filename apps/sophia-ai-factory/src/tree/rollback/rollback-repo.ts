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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RollbackRecord {
  id: string;
  workspaceId: string;
  missionId: string | null;
  agentRunId: string | null;
  reason: string;
  fromStatus: string;
  toStatus: string;
  triggeredBy: string;
  rolledBackAt: number;
}

export interface RollbackInput {
  workspaceId: string;
  missionId?: string;
  agentRunId?: string;
  reason: string;
  fromStatus: string;
  toStatus: string;
  triggeredBy: string;
}

export type RollbackRepoError =
  | { code: 'DB_UNAVAILABLE'; message: string }
  | { code: 'DB_ERROR'; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toErrorCode(err: unknown): RollbackRepoError {
  const message = err instanceof Error ? err.message : String(err);
  return { code: 'DB_ERROR', message };
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `rb_${timestamp}_${randomPart}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

    const id = generateId();
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
      .all<{
        id: string;
        workspace_id: string;
        mission_id: string | null;
        agent_run_id: string | null;
        reason: string;
        from_status: string;
        to_status: string;
        triggered_by: string;
        rolled_back_at: number;
      }>();

    const records: RollbackRecord[] = (rows.results ?? []).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      missionId: row.mission_id,
      agentRunId: row.agent_run_id,
      reason: row.reason,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      triggeredBy: row.triggered_by,
      rolledBackAt: row.rolled_back_at,
    }));

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
