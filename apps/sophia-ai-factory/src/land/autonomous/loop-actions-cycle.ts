'use server';

/**
 * Autonomous Cycle Execution Action
 * Land Layer - Heartbeat cycle dispatch, capability execution, and telemetry recording
 *
 * @module land/autonomous/loop-actions-cycle
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomousScheduleTaskRow,
  AutonomousCycleTelemetry,
  AutonomousEngineState,
  StateTransitionResult,
  AutonomousActionResult,
  TriggerCycleOptions,
} from '@/seed/types/autonomous-engine';
import {
  transitionAutonomousState,
  AutonomousStateTransitionError,
} from '@/tree/autonomous/state-machine';
import { resolveDb, ensureTenantLoopState } from './loop-actions-db';
import { executeDueTasks } from './loop-actions-task-executor';

export { executeDueTasks } from './loop-actions-task-executor';
export type { CycleExecTotals } from './loop-actions-task-executor';

/**
 * Action: Trigger an Autonomous Execution Cycle.
 */
export async function triggerAutonomousCycleAction(
  options: TriggerCycleOptions = {},
): Promise<AutonomousActionResult<AutonomousCycleTelemetry>> {
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
      return { success: false, error: 'Autonomous loop is PAUSED. Pass force: true or resume before triggering.' };
    }
    if (current.state === 'CIRCUIT_BROKEN' && !force) {
      return { success: false, error: 'Circuit breaker is OPEN. Reset circuit or wait for cooldown.' };
    }

    const startEvent = force && current.state === 'PAUSED' ? 'FORCE_CYCLE_CMD' : 'TRIGGER_CYCLE';
    let runningTransition: StateTransitionResult;
    try {
      runningTransition = transitionAutonomousState(current.state as AutonomousEngineState, startEvent, {
        cycleId,
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        isForceCycle: force,
        now: nowSec,
      });
    } catch (e) {
      if (e instanceof AutonomousStateTransitionError) return { success: false, error: e.message };
      throw e;
    }

    const leaseRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, current_cycle_id = ?2, version = version + 1,
             last_heartbeat_at = ?3, updated_at = ?4
         WHERE id = ?5 AND version = ?6`,
      )
      .bind(runningTransition.nextState, cycleId, nowSec, nowSec, current.id, current.version)
      .run();

    if (!leaseRes.meta.changes) {
      return { success: false, error: 'Failed to acquire execution lease: state was updated concurrently.' };
    }

    const dueTasksResult = await db
      .prepare(
        `SELECT * FROM autonomous_schedule_tasks
         WHERE (tenant_id = ?1 OR tenant_id = 'default') AND enabled = 1 AND (next_run_at IS NULL OR next_run_at <= ?2)
         ORDER BY priority ASC, next_run_at ASC`,
      )
      .bind(tenantId, nowSec)
      .all<AutonomousScheduleTaskRow>();

    const totals = await executeDueTasks(
      db,
      dueTasksResult.results ?? [],
      tenantId,
      nowSec,
      availableMcu,
      maxTokensPerCycle,
    );

    const durationMs = Date.now() - startTime;
    const finalEvent = totals.tasksFailed > 0 && totals.tasksSucceeded === 0 ? 'TASK_FAILURE' : 'CYCLE_SUCCESS';
    const newFailures = totals.tasksFailed > 0 ? current.consecutive_failures + 1 : 0;

    const endTransition = transitionAutonomousState('RUNNING', finalEvent, {
      cycleId,
      consecutiveFailures: newFailures,
      maxConsecutiveFailuresThreshold: 5,
      isBudgetExceeded: false,
      now: Math.floor(Date.now() / 1000),
    });

    await db
      .prepare(
        `INSERT INTO autonomous_cycle_runs (
          id, tenant_id, trigger_type, state_before, state_after,
          tasks_attempted, tasks_succeeded, tasks_failed,
          mcu_consumed, tokens_consumed, cost_cents,
          consciousness_score, duration_ms, error_summary, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
      )
      .bind(
        cycleId,
        tenantId,
        force ? 'manual_force' : 'scheduler',
        runningTransition.previousState,
        endTransition.nextState,
        totals.tasksAttempted,
        totals.tasksSucceeded,
        totals.tasksFailed,
        totals.mcuConsumed,
        totals.tokensConsumed,
        Math.round(totals.mcuConsumed * 0.05),
        100 - Math.min(newFailures * 10, 50),
        durationMs,
        totals.tasksFailed > 0 ? `${totals.tasksFailed} tasks failed during cycle` : null,
        nowSec,
      )
      .run();

    const nowSecEnd = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, current_cycle_id = NULL, consecutive_failures = ?2,
             daily_mcu_consumed = daily_mcu_consumed + ?3,
             monthly_mcu_consumed = monthly_mcu_consumed + ?4,
             last_heartbeat_at = ?5, version = version + 1, updated_at = ?6
         WHERE id = ?7`,
      )
      .bind(endTransition.nextState, newFailures, totals.mcuConsumed, totals.mcuConsumed, nowSecEnd, nowSecEnd, current.id)
      .run();

    return {
      success: true,
      data: {
        cycleId,
        tenantId,
        startedAt: startTime,
        completedAt: Date.now(),
        stateBefore: runningTransition.previousState,
        stateAfter: endTransition.nextState,
        tasksAttempted: totals.tasksAttempted,
        tasksSucceeded: totals.tasksSucceeded,
        tasksFailed: totals.tasksFailed,
        mcuConsumed: totals.mcuConsumed,
        tokensConsumed: totals.tokensConsumed,
        costEstimateUsd: totals.mcuConsumed * 0.0005,
        consciousnessScore: 100 - Math.min(newFailures * 10, 50),
        durationMs,
        errorSummary: totals.tasksFailed > 0 ? `${totals.tasksFailed} tasks failed` : null,
      },
    };
  } catch (err) {
    logger.error('[Autonomous Land Action] triggerAutonomousCycleAction error', {
      tenantId,
      error: String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
