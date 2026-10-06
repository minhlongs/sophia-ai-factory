'use server';

/**
 * Autonomous Loop Cycle Execution Engine
 *
 * Layer: land/autonomous
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module land/autonomous/loop-cycle-runner
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomousScheduleTaskRow,
  AutonomousCycleTelemetry,
  AutonomousEngineState,
  StateTransitionResult,
} from '@/seed/types/autonomous-engine';
import {
  transitionAutonomousState,
  AutonomousStateTransitionError,
} from '@/tree/autonomous/state-machine';
import { calculateNextCronRun } from '@/tree/autonomous/cron-evaluator';
import { executeSwarmTask } from '@/tree/autonomous/swarm-orchestrator';
import {
  resolveDb,
  ensureTenantLoopState,
  type ActionResult,
  type TriggerCycleOptions,
} from './loop-actions-db';

/**
 * Action: Trigger an Autonomous Execution Cycle.
 */
export async function triggerAutonomousCycleAction(
  options: TriggerCycleOptions = {}
): Promise<ActionResult<AutonomousCycleTelemetry>> {
  const tenantId = options.tenantId ?? 'default';
  const force = options.force ?? false;
  const availableMcu = options.availableMcu ?? 50000;
  const maxTokensPerCycle = options.maxTokensPerCycle ?? 50000;
  const cycleId = `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();
  const nowSec = Math.floor(startTime / 1000);

  try {
    const db = resolveDb(options.dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);

    if (current.state === 'PAUSED' && !force) {
      return {
        success: false,
        error: 'Autonomous loop is PAUSED. Pass force: true or resume before triggering.',
      };
    }

    if (current.state === 'CIRCUIT_BROKEN' && !force) {
      return {
        success: false,
        error: 'Circuit breaker is OPEN. Reset circuit or wait for cooldown.',
      };
    }

    const startEvent = force && current.state === 'PAUSED' ? 'FORCE_CYCLE_CMD' : 'TRIGGER_CYCLE';
    let runningTransition: StateTransitionResult;
    try {
      runningTransition = transitionAutonomousState(
        current.state as AutonomousEngineState,
        startEvent,
        {
          cycleId,
          consecutiveFailures: current.consecutive_failures,
          maxConsecutiveFailuresThreshold: 5,
          isBudgetExceeded: false,
          isForceCycle: force,
          now: nowSec,
        }
      );
    } catch (e) {
      if (e instanceof AutonomousStateTransitionError) {
        return { success: false, error: e.message };
      }
      throw e;
    }

    const leaseRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, current_cycle_id = ?2, version = version + 1,
             last_heartbeat_at = ?3, updated_at = ?4
         WHERE id = ?5 AND version = ?6`
      )
      .bind(
        runningTransition.nextState,
        cycleId,
        nowSec,
        nowSec,
        current.id,
        current.version
      )
      .run();

    if (!leaseRes.meta.changes) {
      return {
        success: false,
        error: 'Failed to acquire execution lease: state was updated concurrently.',
      };
    }

    const dueTasksResult = await db
      .prepare(
        `SELECT * FROM autonomous_schedule_tasks
         WHERE (tenant_id = ?1 OR tenant_id = 'default')
           AND enabled = 1
           AND (next_run_at IS NULL OR next_run_at <= ?2)
         ORDER BY priority ASC, next_run_at ASC`
      )
      .bind(tenantId, nowSec)
      .all<AutonomousScheduleTaskRow>();

    const dueTasks = dueTasksResult.results ?? [];

    let tasksAttempted = 0;
    let tasksSucceeded = 0;
    let tasksFailed = 0;
    let mcuConsumedTotal = 0.0;
    let tokensConsumedTotal = 0;
    const actionsTakenAll: string[] = [];

    for (const task of dueTasks) {
      tasksAttempted++;
      const execResult = executeSwarmTask(task, {
        tenantId,
        availableMcu: availableMcu - mcuConsumedTotal,
        maxTokensPerCycle: maxTokensPerCycle - tokensConsumedTotal,
      });

      if (execResult.success) {
        tasksSucceeded++;
        mcuConsumedTotal += execResult.mcuConsumed;
        tokensConsumedTotal += execResult.tokensUsed;
        actionsTakenAll.push(...execResult.actionsTaken);

        let nextRunSec: number | null = null;
        if (task.schedule_type === 'cron' && task.schedule_expression) {
          const nextDate = calculateNextCronRun(
            task.schedule_expression,
            new Date(nowSec * 1000),
            task.timezone || 'UTC'
          );
          nextRunSec = Math.floor(nextDate.getTime() / 1000);
        } else if (task.schedule_type === 'interval' && task.interval_seconds) {
          nextRunSec = nowSec + task.interval_seconds;
        }

        await db
          .prepare(
            `UPDATE autonomous_schedule_tasks
             SET last_run_at = ?1, next_run_at = ?2, run_count = run_count + 1, updated_at = ?3
             WHERE id = ?4`
          )
          .bind(nowSec, nextRunSec, nowSec, task.id)
          .run();
      } else {
        tasksFailed++;
        const dlqId = `dlq_${task.id}_${nowSec}_${Math.random().toString(36).substring(2, 6)}`;
        const errMsg = execResult.error ?? 'Execution failed';

        await db
          .prepare(
            `INSERT INTO autonomous_dead_letter_queue (
              id, tenant_id, task_id, skill_name, payload_json, error_message,
              error_stack, retry_count, max_retries, status, first_failed_at, last_failed_at, created_at
            ) VALUES (?1, ?2, ?3, ?4, '{}', ?5, NULL, 1, 3, 'dead', ?6, ?7, ?8)`
          )
          .bind(dlqId, tenantId, task.id, task.skill_name, errMsg, nowSec, nowSec, nowSec)
          .run();

        await db
          .prepare(
            `UPDATE autonomous_schedule_tasks
             SET failure_count = failure_count + 1, updated_at = ?1
             WHERE id = ?2`
          )
          .bind(nowSec, task.id)
          .run();
      }
    }

    const durationMs = Date.now() - startTime;
    const finalEvent = tasksFailed > 0 && tasksSucceeded === 0 ? 'TASK_FAILURE' : 'CYCLE_SUCCESS';
    const newFailures = tasksFailed > 0 ? current.consecutive_failures + 1 : 0;

    const endTransition = transitionAutonomousState(
      'RUNNING',
      finalEvent,
      {
        cycleId,
        consecutiveFailures: newFailures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        now: Math.floor(Date.now() / 1000),
      }
    );

    await db
      .prepare(
        `INSERT INTO autonomous_cycle_runs (
          id, tenant_id, trigger_type, state_before, state_after,
          tasks_attempted, tasks_succeeded, tasks_failed,
          mcu_consumed, tokens_consumed, cost_cents,
          consciousness_score, duration_ms, error_summary, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
      )
      .bind(
        cycleId,
        tenantId,
        force ? 'manual_force' : 'scheduler',
        runningTransition.previousState,
        endTransition.nextState,
        tasksAttempted,
        tasksSucceeded,
        tasksFailed,
        mcuConsumedTotal,
        tokensConsumedTotal,
        Math.round(mcuConsumedTotal * 0.05),
        100 - Math.min(newFailures * 10, 50),
        durationMs,
        tasksFailed > 0 ? `${tasksFailed} tasks failed during cycle` : null,
        nowSec
      )
      .run();

    const nowSecEnd = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1,
             current_cycle_id = NULL,
             consecutive_failures = ?2,
             daily_mcu_consumed = daily_mcu_consumed + ?3,
             monthly_mcu_consumed = monthly_mcu_consumed + ?4,
             last_heartbeat_at = ?5,
             version = version + 1,
             updated_at = ?6
         WHERE id = ?7`
      )
      .bind(
        endTransition.nextState,
        newFailures,
        mcuConsumedTotal,
        mcuConsumedTotal,
        nowSecEnd,
        nowSecEnd,
        current.id
      )
      .run();

    const telemetry: AutonomousCycleTelemetry = {
      cycleId,
      tenantId,
      startedAt: startTime,
      completedAt: Date.now(),
      stateBefore: runningTransition.previousState,
      stateAfter: endTransition.nextState,
      tasksAttempted,
      tasksSucceeded,
      tasksFailed,
      mcuConsumed: mcuConsumedTotal,
      tokensConsumed: tokensConsumedTotal,
      costEstimateUsd: mcuConsumedTotal * 0.0005,
      consciousnessScore: 100 - Math.min(newFailures * 10, 50),
      durationMs,
      errorSummary: tasksFailed > 0 ? `${tasksFailed} tasks failed` : null,
    };

    return { success: true, data: telemetry };
  } catch (err) {
    logger.error('[Autonomous Land Action] triggerAutonomousCycleAction error', {
      tenantId,
      error: String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
