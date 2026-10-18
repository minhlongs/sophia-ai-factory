/**
 * Agent Approval Guarded State Transitions & Expiry
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission/agent-repo/approval-guards
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';

export { expireStaleApprovals } from './approval-expiry';

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
