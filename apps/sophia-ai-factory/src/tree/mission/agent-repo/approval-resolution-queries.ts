/**
 * Agent Approval Resolution and Pending Queue Queries
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission/agent-repo/approval-resolution-queries
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { PendingApprovalRecord } from './types';

export async function resolveApproval(
  id: string,
  status: 'approved' | 'rejected',
  reviewerId: string,
  comment?: string,
  workspaceId?: string
): Promise<Result<Record<string, unknown>, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const row = await db.prepare(`SELECT * FROM agent_approvals WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `Approval ${id} not found` });
    }
    if (workspaceId && row.agent_run_id) {
      const runRow = await db.prepare(`SELECT workspace_id FROM agent_runs WHERE id = ?`).bind(row.agent_run_id).first<{ workspace_id: string }>();
      if (runRow && runRow.workspace_id !== workspaceId) {
        return failure({ code: 'FORBIDDEN', message: `Approval ${id} does not belong to workspace ${workspaceId}` });
      }
    }
    if (row.status !== 'pending') {
      return failure({ code: 'ALREADY_RESOLVED', message: `Approval ${id} already resolved` });
    }

    const now = Math.floor(Date.now() / 1000);
    await db.prepare(`UPDATE agent_approvals SET status = ?, reviewer_id = ?, comment = ?, resolved_at = ? WHERE id = ?`)
      .bind(status, reviewerId, comment ?? null, now, id)
      .run();

    const updated = await db.prepare(`SELECT * FROM agent_approvals WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    return success((updated ?? row) as Record<string, unknown>);
  } catch (err) {
    logger.error('resolveApproval failed', { error: err instanceof Error ? err.message : String(err), id, status });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

export async function listPendingApprovals(
  workspaceId: string,
  limit = 50,
  offset = 0
): Promise<Result<{ approvals: PendingApprovalRecord[]; count: number }, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const result = await db
      .prepare(
        `SELECT aa.*, ar.agent_id, ar.mission_id
         FROM agent_approvals aa
         JOIN agent_runs ar ON aa.agent_run_id = ar.id
         WHERE ar.workspace_id = ? AND aa.status = 'pending'
         ORDER BY aa.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(workspaceId, limit, offset)
      .all<Record<string, unknown>>();

    const rows = result.results ?? [];
    const approvals: PendingApprovalRecord[] = rows.map((row) => ({
      id: row.id as string,
      agentRunId: row.agent_run_id as string,
      actionId: row.action_id as string,
      actionType: row.action_type as string,
      actionSummary: row.action_summary as string,
      estimatedCostCents: row.estimated_cost_cents as number | null,
      status: row.status as string,
      createdAt: row.created_at as number,
      timeoutAt: row.timeout_at as number,
      agentId: row.agent_id as string,
      missionId: row.mission_id as string | null,
    }));

    return success({ approvals, count: approvals.length });
  } catch (err) {
    logger.error('listPendingApprovals failed', {
      error: err instanceof Error ? err.message : String(err),
      workspaceId,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}
