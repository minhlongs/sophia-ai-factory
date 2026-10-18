/**
 * Autonomous Cycle Persistence & Lease Helpers
 * @module land/autonomous/loop-actions-cycle-persistence
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AutonomousScheduleTaskRow,
  AutonomousCycleTelemetry,
  AutonomousEngineState,
  AutonomousLoopStateRow,
} from '@/seed/types/autonomous-engine';

export interface CycleTaskTotals {
  tasksAttempted: number;
  tasksSucceeded: number;
  tasksFailed: number;
  mcuConsumed: number;
  tokensConsumed: number;
}

export function validatePreCycleState(current: AutonomousLoopStateRow, force: boolean): string | null {
  if (current.state === 'PAUSED' && !force) {
    return 'Autonomous loop is PAUSED. Pass force: true or resume before triggering.';
  }
  if (current.state === 'CIRCUIT_BROKEN' && !force) {
    return 'Circuit breaker is OPEN. Reset circuit or wait for cooldown.';
  }
  return null;
}

export async function acquireCycleExecutionLease(
  db: D1Database,
  nextState: AutonomousEngineState,
  cycleId: string,
  nowSec: number,
  stateId: string,
  version: number,
): Promise<boolean> {
  const leaseRes = await db
    .prepare(
      `UPDATE autonomous_loop_state SET state = ?1, current_cycle_id = ?2, version = version + 1, last_heartbeat_at = ?3, updated_at = ?4 WHERE id = ?5 AND version = ?6`,
    )
    .bind(nextState, cycleId, nowSec, nowSec, stateId, version)
    .run();
  return Boolean(leaseRes.meta.changes);
}

export async function queryDueScheduleTasks(
  db: D1Database,
  tenantId: string,
  nowSec: number,
): Promise<AutonomousScheduleTaskRow[]> {
  const dueTasksResult = await db
    .prepare(
      `SELECT * FROM autonomous_schedule_tasks WHERE (tenant_id = ?1 OR tenant_id = 'default') AND enabled = 1 AND (next_run_at IS NULL OR next_run_at <= ?2) ORDER BY priority ASC, next_run_at ASC`,
    )
    .bind(tenantId, nowSec)
    .all<AutonomousScheduleTaskRow>();
  return dueTasksResult.results ?? [];
}

export interface FinalizeCycleParams {
  db: D1Database;
  cycleId: string;
  tenantId: string;
  stateId: string;
  force: boolean;
  stateBefore: AutonomousEngineState;
  stateAfter: AutonomousEngineState;
  totals: CycleTaskTotals;
  newFailures: number;
  startTime: number;
  durationMs: number;
  nowSec: number;
}

export async function finalizeCycleTelemetryAndState(p: FinalizeCycleParams): Promise<AutonomousCycleTelemetry> {
  const { db, cycleId, tenantId, stateId, force, stateBefore, stateAfter, totals, newFailures, startTime, durationMs, nowSec } = p;
  const consciousnessScore = 100 - Math.min(newFailures * 10, 50);

  await db
    .prepare(
      `INSERT INTO autonomous_cycle_runs (id, tenant_id, trigger_type, state_before, state_after, tasks_attempted, tasks_succeeded, tasks_failed, mcu_consumed, tokens_consumed, cost_cents, consciousness_score, duration_ms, error_summary, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
    )
    .bind(
      cycleId, tenantId, force ? 'manual_force' : 'scheduler', stateBefore, stateAfter,
      totals.tasksAttempted, totals.tasksSucceeded, totals.tasksFailed,
      totals.mcuConsumed, totals.tokensConsumed, Math.round(totals.mcuConsumed * 0.05),
      consciousnessScore, durationMs,
      totals.tasksFailed > 0 ? `${totals.tasksFailed} tasks failed during cycle` : null, nowSec,
    )
    .run();

  const nowSecEnd = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE autonomous_loop_state SET state = ?1, current_cycle_id = NULL, consecutive_failures = ?2, daily_mcu_consumed = daily_mcu_consumed + ?3, monthly_mcu_consumed = monthly_mcu_consumed + ?4, last_heartbeat_at = ?5, version = version + 1, updated_at = ?6 WHERE id = ?7`,
    )
    .bind(stateAfter, newFailures, totals.mcuConsumed, totals.mcuConsumed, nowSecEnd, nowSecEnd, stateId)
    .run();

  return {
    cycleId, tenantId, startedAt: startTime, completedAt: Date.now(), stateBefore, stateAfter,
    tasksAttempted: totals.tasksAttempted, tasksSucceeded: totals.tasksSucceeded, tasksFailed: totals.tasksFailed,
    mcuConsumed: totals.mcuConsumed, tokensConsumed: totals.tokensConsumed,
    costEstimateUsd: totals.mcuConsumed * 0.0005, consciousnessScore, durationMs,
    errorSummary: totals.tasksFailed > 0 ? `${totals.tasksFailed} tasks failed` : null,
  };
}
