/**
 * Agent Approval Guarded State Transitions & Expiry
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission/agent-repo/approval-guards
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { ExpiredApproval } from './types';

/**
 * Guarded terminal fail of a run that is currently awaiting_approval.
 */
export async function failAwaitingRun(
  id: string,
  errorJson: Record<string, unknown>,
  errorMessage: string
): Promise<Result<{ failed: boolean }, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const result = await db
      .prepare(
        `UPDATE agent_runs
         SET status = 'failed', phase = 'failed',
             error_message = ?, error_json = ?, ended_at = ?
         WHERE id = ? AND status = 'awaiting_approval'`
      )
      .bind(errorMessage, JSON.stringify(errorJson), nowSec, id)
      .run();
    return success({ failed: result.meta.changes > 0 });
  } catch (err) {
    logger.error('failAwaitingRun failed', {
      error: err instanceof Error ? err.message : String(err),
      id,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

/**
 * Guarded flip of a running agent run to awaiting_approval.
 */
export async function markRunAwaitingApproval(
  id: string
): Promise<Result<{ flipped: boolean }, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }
    const result = await db
      .prepare(
        `UPDATE agent_runs
         SET status = 'awaiting_approval', phase = 'awaiting_approval'
         WHERE id = ? AND status = 'running'`
      )
      .bind(id)
      .run();
    return success({ flipped: result.meta.changes > 0 });
  } catch (err) {
    logger.error('markRunAwaitingApproval failed', {
      error: err instanceof Error ? err.message : String(err),
      id,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}

/**
 * Expire pending approvals whose timeout_at has passed and fail their still-
 * awaiting_approval runs with APPROVAL_TIMEOUT.
 */
export async function expireStaleApprovals(
  nowIso?: string
): Promise<Result<{ expiredCount: number; expired: ExpiredApproval[] }, { code: string; message: string }>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    }

    const nowSec = nowIso === undefined
      ? Math.floor(Date.now() / 1000)
      : Math.floor(new Date(nowIso).getTime() / 1000);
    if (Number.isNaN(nowSec)) {
      return failure({ code: 'INVALID_TIME', message: `Invalid nowIso: ${nowIso}` });
    }

    const overdue = await db
      .prepare(
        `SELECT id, agent_run_id
         FROM agent_approvals
         WHERE status = 'pending' AND timeout_at IS NOT NULL AND timeout_at <= ?`
      )
      .bind(nowSec)
      .all<Record<string, unknown>>();

    const candidates = overdue.results ?? [];
    if (candidates.length === 0) {
      return success({ expiredCount: 0, expired: [] });
    }

    const expired: ExpiredApproval[] = [];
    for (const row of candidates) {
      const id = row.id as string;
      const agentRunId = row.agent_run_id as string;
      const flip = await db
        .prepare(
          `UPDATE agent_approvals
           SET status = 'expired', resolved_at = ?
           WHERE id = ? AND status = 'pending'`
        )
        .bind(nowSec, id)
        .run();
      if (flip.meta.changes > 0) {
        expired.push({ id, agentRunId });
      }
    }

    for (const item of expired) {
      await db
        .prepare(
          `UPDATE agent_runs
           SET status = 'failed', phase = 'failed',
               error_message = ?, error_json = ?, ended_at = ?
           WHERE id = ? AND status = 'awaiting_approval'`
        )
        .bind(
          'Approval expired before review',
          JSON.stringify({ code: 'APPROVAL_TIMEOUT', approvalId: item.id }),
          nowSec,
          item.agentRunId
        )
        .run();
    }

    return success({ expiredCount: expired.length, expired });
  } catch (err) {
    logger.error('expireStaleApprovals failed', {
      error: err instanceof Error ? err.message : String(err),
      nowIso,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}
