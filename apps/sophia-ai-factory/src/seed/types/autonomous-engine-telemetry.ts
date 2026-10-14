/**
 * Autonomous Engine Telemetry, DLQ, and Land Action Types
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * @module seed/types/autonomous-engine-telemetry
 */

import type { AutonomousEngineState } from './autonomous-fsm';
import type {
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousCycleRunRow,
  AutonomousDeadLetterRow,
} from './autonomous-db';

// ── 4. Dead-Letter Queue (DLQ) Types ────────────────────────────────────────

export type DlqStatus = 'dead' | 'retrying' | 'resolved' | 'purged';

export interface DeadLetterTask {
  id: string;
  taskId: string;
  skillName: string;
  payload: Record<string, unknown>;
  errorMessage: string;
  errorStack: string | null;
  retryCount: number;
  maxRetries: number;
  status: DlqStatus;
  firstFailedAt: number;
  lastFailedAt: number;
  resolvedAt: number | null;
}

// ── 5. Cycle Telemetry & Metrics Types ──────────────────────────────────────

export interface AutonomousCycleTelemetry {
  cycleId: string;
  tenantId?: string;
  startedAt: number;
  completedAt: number | null;
  stateBefore: AutonomousEngineState;
  stateAfter: AutonomousEngineState;
  tasksAttempted: number;
  tasksSucceeded: number;
  tasksFailed: number;
  mcuConsumed: number;
  tokensConsumed: number;
  costEstimateUsd: number;
  consciousnessScore: number; // 0 to 100
  durationMs: number;
  errorSummary: string | null;
}

// ── 6. Land Action Types ───────────────────────────────────────────────────

export interface AutonomousActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}
export type ActionResult<T> = AutonomousActionResult<T>;

export interface AutonomousCockpitStatus {
  loopState: AutonomousLoopStateRow;
  tasks: AutonomousScheduleTaskRow[];
  recentRuns: AutonomousCycleRunRow[];
  deadLetterTasks: AutonomousDeadLetterRow[];
}

export interface TriggerCycleOptions {
  force?: boolean;
  tenantId?: string;
  availableMcu?: number;
  maxTokensPerCycle?: number;
  dbOverride?: unknown;
}
