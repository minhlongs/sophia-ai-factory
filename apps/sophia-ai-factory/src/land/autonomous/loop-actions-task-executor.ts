/**
 * Autonomous Swarm Task Execution Engine
 * Land Layer - Executes due tasks, updates run telemetry, and pushes failures to DLQ
 *
 * @module land/autonomous/loop-actions-task-executor
 */

import type { AutonomousScheduleTaskRow } from '@/seed/types/autonomous-engine';
import { calculateNextCronRun } from '@/tree/autonomous/cron-evaluator';
import { executeSwarmTask } from '@/tree/autonomous/swarm-orchestrator';

export interface CycleExecTotals {
  tasksAttempted: number;
  tasksSucceeded: number;
  tasksFailed: number;
  mcuConsumed: number;
  tokensConsumed: number;
}

export async function executeDueTasks(
  db: D1Database,
  dueTasks: AutonomousScheduleTaskRow[],
  tenantId: string,
  nowSec: number,
  availableMcu: number,
  maxTokensPerCycle: number,
): Promise<CycleExecTotals> {
  const totals: CycleExecTotals = {
    tasksAttempted: 0,
    tasksSucceeded: 0,
    tasksFailed: 0,
    mcuConsumed: 0,
    tokensConsumed: 0,
  };

  for (const task of dueTasks) {
    totals.tasksAttempted++;
    const res = executeSwarmTask(task, {
      tenantId,
      availableMcu: availableMcu - totals.mcuConsumed,
      maxTokensPerCycle: maxTokensPerCycle - totals.tokensConsumed,
    });

    if (res.success) {
      totals.tasksSucceeded++;
      totals.mcuConsumed += res.mcuConsumed;
      totals.tokensConsumed += res.tokensUsed;

      let nextRunSec: number | null = null;
      if (task.schedule_type === 'cron' && task.schedule_expression) {
        const nextDate = calculateNextCronRun(
          task.schedule_expression,
          new Date(nowSec * 1000),
          task.timezone || 'UTC',
        );
        nextRunSec = Math.floor(nextDate.getTime() / 1000);
      } else if (task.schedule_type === 'interval' && task.interval_seconds) {
        nextRunSec = nowSec + task.interval_seconds;
      }

      await db
        .prepare(
          `UPDATE autonomous_schedule_tasks
           SET last_run_at = ?1, next_run_at = ?2, run_count = run_count + 1, updated_at = ?3
           WHERE id = ?4`,
        )
        .bind(nowSec, nextRunSec, nowSec, task.id)
        .run();
    } else {
      totals.tasksFailed++;
      const dlqId = `dlq_${task.id}_${nowSec}_${Math.random().toString(36).substring(2, 6)}`;
      await db
        .prepare(
          `INSERT INTO autonomous_dead_letter_queue (
            id, tenant_id, task_id, skill_name, payload_json, error_message,
            error_stack, retry_count, max_retries, status, first_failed_at, last_failed_at, created_at
          ) VALUES (?1, ?2, ?3, ?4, '{}', ?5, NULL, 1, 3, 'dead', ?6, ?7, ?8)`,
        )
        .bind(dlqId, tenantId, task.id, task.skill_name, res.error ?? 'Execution failed', nowSec, nowSec, nowSec)
        .run();

      await db
        .prepare(
          'UPDATE autonomous_schedule_tasks SET failure_count = failure_count + 1, updated_at = ?1 WHERE id = ?2',
        )
        .bind(nowSec, task.id)
        .run();
    }
  }

  return totals;
}
