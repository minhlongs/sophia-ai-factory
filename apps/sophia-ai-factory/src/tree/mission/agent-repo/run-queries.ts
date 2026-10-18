/**
 * Agent Run D1 Queries and Updates
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission/agent-repo/run-queries
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { AgentRunRecord, CreateAgentRunInput } from './types';
import { toJson, rowToRun } from './helpers';
import { updateAgentRun } from './run-updater';

export { updateAgentRun };

export async function createAgentRun(
  input: CreateAgentRunInput
): Promise<Result<AgentRunRecord, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(
      `INSERT INTO agent_runs (id, agent_id, workspace_id, mission_id, autonomy_level, input_json, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        input.id,
        input.agentId,
        input.workspaceId,
        input.missionId ?? null,
        input.autonomyLevel,
        toJson(input.inputJson),
        toJson(input.metadata),
        now
      )
      .run();

    const row = await db
      .prepare(`SELECT * FROM agent_runs WHERE id = ?`)
      .bind(input.id)
      .first<Record<string, unknown>>();

    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `AgentRun ${input.id} not found after insert` });
    }

    return success(rowToRun(row));
  } catch (err) {
    logger.error('createAgentRun failed', { error: err instanceof Error ? err.message : String(err), input });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

export async function getAgentRun(
  id: string
): Promise<Result<AgentRunRecord | null, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const row = await db.prepare(`SELECT * FROM agent_runs WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    if (!row) return success(null);
    return success(rowToRun(row));
  } catch (err) {
    logger.error('getAgentRun failed', { error: err instanceof Error ? err.message : String(err), id });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

export async function listAgentRunsForMission(
  missionId: string,
  workspaceId: string,
  limit = 10
): Promise<Result<AgentRunRecord[], { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const result = await db
      .prepare(
        `SELECT * FROM agent_runs WHERE mission_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT ?`
      )
      .bind(missionId, workspaceId, limit)
      .all<Record<string, unknown>>();

    const rows = result.results ?? [];
    return success(rows.map(rowToRun));
  } catch (err) {
    logger.error('listAgentRunsForMission failed', {
      error: err instanceof Error ? err.message : String(err),
      missionId,
      workspaceId,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}
