/**
 * Agent Run D1 Update Mutation
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission/agent-repo/run-updater
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { AgentRunRecord, UpdateAgentRunInput } from './types';
import { toJson, rowToRun } from './helpers';

function buildRunUpdatePatch(patch: UpdateAgentRunInput): { fields: string[]; values: unknown[] } {
  const entries: Array<[string, unknown, boolean]> = [
    ['status = ?', patch.status, Boolean(patch.status)],
    ['phase = ?', patch.phase, Boolean(patch.phase)],
    ['output_json = ?', toJson(patch.outputJson), patch.outputJson !== undefined],
    ['error_json = ?', toJson(patch.errorJson), patch.errorJson !== undefined],
    ['error_message = ?', patch.errorMessage, patch.errorMessage !== undefined],
    ['total_cost_cents = ?', patch.totalCostCents, patch.totalCostCents !== undefined],
    ['total_tokens = ?', patch.totalTokens, patch.totalTokens !== undefined],
    ['retry_count = ?', patch.retryCount, patch.retryCount !== undefined],
    ['started_at = ?', patch.startedAt, patch.startedAt !== undefined],
    ['ended_at = ?', patch.endedAt, patch.endedAt !== undefined],
  ];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [sql, val, include] of entries) {
    if (include) {
      fields.push(sql);
      values.push(val);
    }
  }
  return { fields, values };
}

export async function updateAgentRun(
  id: string,
  patch: UpdateAgentRunInput
): Promise<Result<AgentRunRecord, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }

    const { fields, values } = buildRunUpdatePatch(patch);
    if (fields.length === 0) {
      return failure({ code: 'NO_CHANGES', message: 'No fields to update' });
    }

    values.push(id);
    await db.prepare(`UPDATE agent_runs SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

    const row = await db.prepare(`SELECT * FROM agent_runs WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `AgentRun ${id} not found after update` });
    }

    return success(rowToRun(row));
  } catch (err) {
    logger.error('updateAgentRun failed', { error: err instanceof Error ? err.message : String(err), id, patch });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}
