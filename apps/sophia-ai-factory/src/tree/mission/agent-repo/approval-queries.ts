/**
 * Agent Approval D1 Queries and State Transitions
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission/agent-repo/approval-queries
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { CreateApprovalInput } from './types';

export { resolveApproval, listPendingApprovals } from './approval-resolution-queries';

export async function createApproval(
  input: CreateApprovalInput
): Promise<Result<Record<string, unknown>, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const now = Math.floor(Date.now() / 1000);
    const timeoutAt = input.timeoutAt ?? now + 86400;
    await db.prepare(
      `INSERT INTO agent_approvals (id, agent_run_id, action_id, action_type, action_summary, estimated_cost_cents, status, created_at, timeout_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        input.id,
        input.agentRunId,
        input.actionId,
        input.actionType,
        input.actionSummary,
        input.estimatedCostCents ?? null,
        'pending',
        now,
        timeoutAt
      )
      .run();

    return success({
      id: input.id,
      agentRunId: input.agentRunId,
      actionId: input.actionId,
      actionType: input.actionType,
      actionSummary: input.actionSummary,
      estimatedCostCents: input.estimatedCostCents,
      status: 'pending',
      createdAt: now,
      timeoutAt,
    });
  } catch (err) {
    logger.error('createApproval failed', { error: err instanceof Error ? err.message : String(err), input });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

export async function getApproval(
  id: string
): Promise<Result<Record<string, unknown> | null, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const row = await db.prepare(`SELECT * FROM agent_approvals WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    if (!row) return success(null);
    return success(row);
  } catch (err) {
    logger.error('getApproval failed', { error: err instanceof Error ? err.message : String(err), id });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}
