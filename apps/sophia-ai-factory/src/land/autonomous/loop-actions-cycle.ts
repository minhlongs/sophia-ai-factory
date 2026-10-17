'use server';

/**
 * Autonomous Cycle Execution Action
 * Land Layer - Heartbeat cycle dispatch, capability execution, and telemetry recording
 *
 * @module land/autonomous/loop-actions-cycle
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
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
import {
  validatePreCycleState,
  acquireCycleExecutionLease,
  queryDueScheduleTasks,
  finalizeCycleTelemetryAndState,
} from './loop-actions-cycle-persistence';

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

    const stateGateError = validatePreCycleState(current, force);
    if (stateGateError) {
      return { success: false, error: stateGateError };
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

    const acquired = await acquireCycleExecutionLease(
      db,
      runningTransition.nextState,
      cycleId,
      nowSec,
      current.id,
      current.version,
    );
    if (!acquired) {
      return { success: false, error: 'Failed to acquire execution lease: state was updated concurrently.' };
    }

    const dueTasks = await queryDueScheduleTasks(db, tenantId, nowSec);
    const totals = await executeDueTasks(
      db,
      dueTasks,
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

    const telemetry = await finalizeCycleTelemetryAndState({
      db,
      cycleId,
      tenantId,
      stateId: current.id,
      force,
      stateBefore: runningTransition.previousState,
      stateAfter: endTransition.nextState,
      totals,
      newFailures,
      startTime,
      durationMs,
      nowSec,
    });

    return { success: true, data: telemetry };
  } catch (err) {
    logger.error('[Autonomous Land Action] triggerAutonomousCycleAction error', {
      tenantId,
      error: String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
