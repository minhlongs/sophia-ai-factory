'use server';

/**
 * Autonomous AGI Loop Control & Heartbeat Scheduler Server Actions
 *
 * Layer: land/autonomous (Server Actions & Mutation Endpoints)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (seed -> tree -> forest -> land)
 *
 * Provides transactional server actions for:
 * - Querying real-time loop state, scheduled tasks, DLQ, and cycle runs
 * - Deterministic FSM lifecycle transitions (Start, Pause, Resume, Emergency Halt, Reset Circuit)
 * - Autonomous cycle execution with capability dispatch (Affiliate Scout, Content Producer, Auto-Publisher)
 * - DLQ task replay and failure remediation
 *
 * @module land/autonomous/loop-actions
 */

import { getD1Sync } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousDeadLetterRow,
  AutonomousCycleRunRow,
  AutonomousCycleTelemetry,
  AutonomousEngineState,
  StateTransitionResult,
  AutonomousCapability,
} from '@/seed/types/autonomous-engine';
import {
  transitionAutonomousState,
  AutonomousStateTransitionError,
} from '@/tree/autonomous/state-machine';
import { calculateNextCronRun } from '@/tree/autonomous/cron-evaluator';
import { executeSwarmTask, canExecuteCapability } from '@/tree/autonomous/swarm-orchestrator';

/**
 * Resolves active D1 database binding.
 */
function resolveDb(dbOverride?: unknown): D1Database {
  if (dbOverride && typeof (dbOverride as D1Database).prepare === 'function') {
    return dbOverride as D1Database;
  }
  return getD1Sync();
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface AutonomousCockpitStatus {
  loopState: AutonomousLoopStateRow;
  tasks: AutonomousScheduleTaskRow[];
  recentRuns: AutonomousCycleRunRow[];
  deadLetterTasks: AutonomousDeadLetterRow[];
}

/**
 * Helper to ensure a tenant singleton loop state row exists.
 */
async function ensureTenantLoopState(
  db: D1Database,
  tenantId: string
): Promise<AutonomousLoopStateRow> {
  const existing = await db
    .prepare(
      `SELECT * FROM autonomous_loop_state WHERE tenant_id = ?1 LIMIT 1`
    )
    .bind(tenantId)
    .first<AutonomousLoopStateRow>();

  if (existing) {
    return existing;
  }

  const now = Math.floor(Date.now() / 1000);
  const id = `singleton_${tenantId}`;
  await db
    .prepare(
      `INSERT OR IGNORE INTO autonomous_loop_state (
        id, tenant_id, state, current_cycle_id, consecutive_failures, last_error,
        consciousness_score, daily_mcu_consumed, monthly_mcu_consumed,
        daily_spend_cents, monthly_spend_cents, last_heartbeat_at, version, created_at, updated_at
      ) VALUES (?1, ?2, 'IDLE', NULL, 0, NULL, 100, 0.0, 0.0, 0, 0, ?3, 1, ?4, ?5)`
    )
    .bind(id, tenantId, now, now, now)
    .run();

  const created = await db
    .prepare(
      `SELECT * FROM autonomous_loop_state WHERE tenant_id = ?1 LIMIT 1`
    )
    .bind(tenantId)
    .first<AutonomousLoopStateRow>();

  if (!created) {
    throw new Error(`Failed to initialize loop state for tenant: ${tenantId}`);
  }
  return created;
}

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
 * Action: Start the autonomous execution loop (IDLE -> RUNNING).
 */
export async function startAutonomousLoopAction(
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      'START',
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        now,
      }
    );

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, version = version + 1, updated_at = ?2, last_heartbeat_at = ?3
         WHERE id = ?4 AND version = ?5`
      )
      .bind(transition.nextState, now, now, current.id, current.version)
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error('[Autonomous Land Action] startAutonomousLoopAction error', {
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
 * Action: Pause the autonomous execution loop.
 */
export async function pauseAutonomousLoopAction(
  reason: string = 'Manual operator pause',
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      'PAUSE_CMD',
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        pauseReason: reason,
        now,
      }
    );

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, version = version + 1, updated_at = ?2
         WHERE id = ?3 AND version = ?4`
      )
      .bind(transition.nextState, now, current.id, current.version)
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error('[Autonomous Land Action] pauseAutonomousLoopAction error', {
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
 * Action: Resume the autonomous execution loop from PAUSED to IDLE.
 */
export async function resumeAutonomousLoopAction(
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      'RESUME_CMD',
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        now,
      }
    );

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, version = version + 1, updated_at = ?2, last_heartbeat_at = ?3
         WHERE id = ?4 AND version = ?5`
      )
      .bind(transition.nextState, now, now, current.id, current.version)
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error('[Autonomous Land Action] resumeAutonomousLoopAction error', {
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
 * Action: Emergency Halt — immediate suspension to PAUSED from any state.
 */
export async function emergencyHaltAutonomousLoopAction(
  reason: string = 'Emergency stop triggered by operator',
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      'EMERGENCY_HALT',
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        pauseReason: reason,
        now,
      }
    );

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, version = version + 1, updated_at = ?2, last_error = ?3
         WHERE id = ?4 AND version = ?5`
      )
      .bind(transition.nextState, now, reason, current.id, current.version)
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error('[Autonomous Land Action] emergencyHaltAutonomousLoopAction error', {
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
 * Action: Reset Circuit Breaker (CIRCUIT_BROKEN -> IDLE).
 */
export async function resetCircuitBreakerAction(
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      'MANUAL_RESET',
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        now,
      }
    );

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, consecutive_failures = 0, last_error = NULL,
             version = version + 1, updated_at = ?2
         WHERE id = ?3 AND version = ?4`
      )
      .bind(transition.nextState, now, current.id, current.version)
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error('[Autonomous Land Action] resetCircuitBreakerAction error', {
      tenantId,
      error: String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface TriggerCycleOptions {
  force?: boolean;
  tenantId?: string;
  availableMcu?: number;
  maxTokensPerCycle?: number;
  dbOverride?: unknown;
}

/**
 * Action: Trigger an Autonomous Execution Cycle.
 * Performs lease acquisition, task filtering, capability execution, DLQ serialization,
 * and cycle telemetry recording.
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

    // 1. Guard against invalid states
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

    // 2. Transition state machine to RUNNING
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

    // 3. Acquire execution lease in D1
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

    // 4. Fetch due tasks
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

    // 5. Execute due tasks via Swarm Orchestrator
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

        // Calculate next run
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

        // Insert into Dead Letter Queue
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

    // 6. Record cycle run telemetry
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
        Math.round(mcuConsumedTotal * 0.05), // $0.0005 per MCU
        100 - Math.min(newFailures * 10, 50),
        durationMs,
        tasksFailed > 0 ? `${tasksFailed} tasks failed during cycle` : null,
        nowSec
      )
      .run();

    // 7. Update final loop state & release lease
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
      costEstimateUsd: (mcuConsumedTotal * 0.0005),
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

    // Mark as retrying
    await db
      .prepare(
        `UPDATE autonomous_dead_letter_queue
         SET status = 'resolved', resolved_at = ?1
         WHERE id = ?2`
      )
      .bind(now, dlqId)
      .run();

    // Reset task's next_run_at to now so the next cycle picks it up
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
