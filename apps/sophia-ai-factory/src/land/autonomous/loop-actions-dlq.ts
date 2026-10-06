'use server';

/**
 * Autonomous Dead-Letter Queue (DLQ) Remediation Action
 * Land Layer - Replay dead-lettered tasks from DLQ
 *
 * @module land/autonomous/loop-actions-dlq
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomousActionResult,
  AutonomousDeadLetterRow,
} from '@/seed/types/autonomous-engine';
import { resolveDb } from './loop-actions-db';

/**
 * Action: Replay a dead-lettered task from the DLQ.
 */
export async function replayDeadLetterTaskAction(
  dlqId: string,
  tenantId: string = 'default',
  dbOverride?: unknown,
): Promise<AutonomousActionResult<{ replayed: boolean; newStatus: string }>> {
  try {
    const db = resolveDb(dbOverride);
    const now = Math.floor(Date.now() / 1000);

    const dlqItem = await db
      .prepare(
        'SELECT * FROM autonomous_dead_letter_queue WHERE id = ?1 LIMIT 1',
      )
      .bind(dlqId)
      .first<AutonomousDeadLetterRow>();

    if (!dlqItem) {
      return { success: false, error: `DLQ task not found: ${dlqId}` };
    }

    // Mark as resolved
    await db
      .prepare(
        `UPDATE autonomous_dead_letter_queue
         SET status = 'resolved', resolved_at = ?1
         WHERE id = ?2`,
      )
      .bind(now, dlqId)
      .run();

    // Reset task's next_run_at to now so the next cycle picks it up
    await db
      .prepare(
        `UPDATE autonomous_schedule_tasks
         SET next_run_at = ?1, failure_count = 0, updated_at = ?2
         WHERE id = ?3`,
      )
      .bind(now, now, dlqItem.task_id)
      .run();

    return {
      success: true,
      data: { replayed: true, newStatus: 'resolved' },
    };
  } catch (err) {
    logger.error('[Autonomous Land Action] replayDeadLetterTaskAction error', {
      dlqId,
      tenantId,
      error: String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
