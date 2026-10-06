'use server';

/**
 * Autonomous Operations Cockpit Status Query Action
 * Land Layer - Real-time state, schedule, cycle runs, and DLQ queries
 *
 * @module land/autonomous/loop-actions-status
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomousScheduleTaskRow,
  AutonomousDeadLetterRow,
  AutonomousCycleRunRow,
  AutonomousActionResult,
  AutonomousCockpitStatus,
} from '@/seed/types/autonomous-engine';
import { resolveDb, ensureTenantLoopState } from './loop-actions-db';

/**
 * Action: Query entire Autonomous Operations Cockpit state.
 */
export async function getAutonomousLoopStatusAction(
  tenantId: string = 'default',
  dbOverride?: unknown,
): Promise<AutonomousActionResult<AutonomousCockpitStatus>> {
  try {
    const db = resolveDb(dbOverride);
    const loopState = await ensureTenantLoopState(db, tenantId);

    const tasksResult = await db
      .prepare(
        `SELECT * FROM autonomous_schedule_tasks
         WHERE tenant_id = ?1 OR tenant_id = 'default'
         ORDER BY priority ASC, next_run_at ASC`,
      )
      .bind(tenantId)
      .all<AutonomousScheduleTaskRow>();

    const runsResult = await db
      .prepare(
        `SELECT * FROM autonomous_cycle_runs
         WHERE tenant_id = ?1 OR tenant_id = 'default'
         ORDER BY created_at DESC LIMIT 10`,
      )
      .bind(tenantId)
      .all<AutonomousCycleRunRow>();

    const dlqResult = await db
      .prepare(
        `SELECT * FROM autonomous_dead_letter_queue
         WHERE (tenant_id = ?1 OR tenant_id = 'default') AND status = 'dead'
         ORDER BY created_at DESC LIMIT 10`,
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
