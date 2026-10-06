/**
 * Swarm Cycle Telemetry Calculator
 * Tree Layer - Deterministic telemetry, consciousness scoring, and cost estimation
 *
 * @module tree/autonomous/swarm-telemetry
 */

import type {
  AutonomousEngineState,
  AutonomousCycleTelemetry,
  CircuitBreakerStatus,
} from '@/seed/types/autonomous-engine';

import type { SwarmExecutionResult } from './swarm-types';

export interface CalculateCycleTelemetryInput {
  cycleId: string;
  tenantId?: string;
  startedAt: number;
  completedAt?: number;
  stateBefore: AutonomousEngineState;
  stateAfter: AutonomousEngineState;
  taskResults: SwarmExecutionResult[];
  circuitStatus?: CircuitBreakerStatus;
}

/**
 * Computes comprehensive cycle telemetry adhering strictly to AutonomousCycleTelemetry.
 * Calculates consciousness score (0-100), blended USD cost, and aggregates error summaries.
 */
export function calculateCycleTelemetry(
  input: CalculateCycleTelemetryInput,
): AutonomousCycleTelemetry {
  const completedAt = input.completedAt ?? Date.now();
  const durationMs = Math.max(0, completedAt - input.startedAt);

  const tasksAttempted = input.taskResults.length;
  const tasksSucceeded = input.taskResults.filter((r) => r.success).length;
  const tasksFailed = input.taskResults.filter((r) => !r.success).length;

  const mcuConsumed = input.taskResults.reduce(
    (acc, r) => acc + (r.mcuConsumed || 0),
    0,
  );
  const tokensConsumed = input.taskResults.reduce(
    (acc, r) => acc + (r.tokensUsed || 0),
    0,
  );

  // Blended cost: MCU ($0.001/unit) + Tokens ($0.000003/token)
  const costEstimateUsd =
    Math.round((mcuConsumed * 0.001 + tokensConsumed * 0.000003) * 10000) / 10000;

  // Consciousness score calculation (0 to 100)
  let consciousnessScore = 100;
  if (tasksAttempted > 0) {
    const successRatio = tasksSucceeded / tasksAttempted;
    consciousnessScore = Math.round(100 * successRatio);
  }
  if (tasksFailed > 0) {
    consciousnessScore -= tasksFailed * 15;
  }
  if (input.circuitStatus && input.circuitStatus.state !== 'CLOSED') {
    consciousnessScore -= 25;
  }
  if (durationMs > 300000) {
    consciousnessScore -= 10;
  }
  consciousnessScore = Math.min(100, Math.max(0, consciousnessScore));

  const errors = input.taskResults
    .filter((r) => !r.success && r.error)
    .map((r) => r.error as string);
  const errorSummary =
    errors.length > 0 ? Array.from(new Set(errors)).join('; ') : null;

  return {
    cycleId: input.cycleId,
    tenantId: input.tenantId,
    startedAt: input.startedAt,
    completedAt,
    stateBefore: input.stateBefore,
    stateAfter: input.stateAfter,
    tasksAttempted,
    tasksSucceeded,
    tasksFailed,
    mcuConsumed,
    tokensConsumed,
    costEstimateUsd,
    consciousnessScore,
    durationMs,
    errorSummary,
  };
}
