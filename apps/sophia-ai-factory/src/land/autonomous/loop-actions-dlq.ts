'use server';

/**
 * Autonomous Loop DLQ & Status Query Server Actions
 *
 * Layer: land/autonomous
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module land/autonomous/loop-actions-dlq
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomousScheduleTaskRow,
  AutonomousDeadLetterRow,
  AutonomousCycleRunRow,
} from '@/seed/types/autonomous-engine';
import {
  resolveDb,
  ensureTenantLoopState,
  type ActionResult,
  type AutonomousCockpitStatus,
} from './loop-actions-db';

/**
 * Action: Query entire Autonomous Operations Cockpit state.
 */
export async function getAutonomousLoopStatusAction(
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<AutonomousCockpitStatus>> {
  try {
    const db = resolveDb(dbOverride);
    const loopState = await ensureTenantLoopState(db, tenantId);

    const tasksResult = await db
      .prepare(
        `SELECT * FROM autonomous_schedule_tasks
         WHERE tenant_id = ?1 OR tenant_id = 'default'
         ORDER BY priority ASC, next_run_at ASC`
      )
      .bind(tenantId)
      .all<AutonomousScheduleTaskRow>();

    const runsResult = await db
      .prepare(
        `SELECT * FROM autonomous_cycle_runs
         WHERE tenant_id = ?1 OR tenant_id = 'default'
         ORDER BY created_at DESC LIMIT 10`
      )
      .bind(tenantId)
      .all<AutonomousCycleRunRow>();

    const dlqResult = await db
      .prepare(
        `SELECT * FROM autonomous_dead_letter_queue
         WHERE (tenant_id = ?1 OR tenant_id = 'default') AND status = 'dead'
         ORDER BY created_at DESC LIMIT 10`
      )
      .bind(tenantId)
      .all<AutonomousDeadLetterRow>();

    return {
      success: true,
      data: {
        loopState,
        tasks: tasksResult.results ?? [],
        recentRuns: runsResult.results ?? [],
        deadLetterTasks: dlqResult.results ?? [],
      },
    };
  } catch (err) {
    logger.error('[Autonomous Land Action] getAutonomousLoopStatusAction error', {
      tenantId,
      error: String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Action: Replay a dead-lettered task from the DLQ.
 */
export async function replayDeadLetterTaskAction(
  dlqId: string,
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<{ replayed: boolean; newStatus: string }>> {
  try {
    const db = resolveDb(dbOverride);
    const now = Math.floor(Date.now() / 1000);

    const dlqItem = await db
      .prepare(
        `SELECT * FROM autonomous_dead_letter_queue WHERE id = ?1 LIMIT 1`
      )
      .bind(dlqId)
      .first<AutonomousDeadLetterRow>();

    if (!dlqItem) {
      return { success: false, error: `DLQ task not found: ${dlqId}` };
    }

    await db
      .prepare(
        `UPDATE autonomous_dead_letter_queue
         SET status = 'resolved', resolved_at = ?1
         WHERE id = ?2`
      )
      .bind(now, dlqId)
      .run();

    await db
      .prepare(
        `UPDATE autonomous_schedule_tasks
         SET next_run_at = ?1, failure_count = 0, updated_at = ?2
         WHERE id = ?3`
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
      error: String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
