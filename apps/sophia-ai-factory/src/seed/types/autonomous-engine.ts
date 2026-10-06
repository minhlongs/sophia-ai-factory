/**
 * Autonomous Engine & Heartbeat Scheduler Domain Types
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module seed/types/autonomous-engine
 */

import type { AutonomousEngineState } from './autonomous-fsm';
import type {
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousCycleRunRow,
  AutonomousDeadLetterRow,
} from './autonomous-db';

export * from './autonomous-fsm';
export * from './autonomous-db';

// ── 2. Scheduling & Task Types ──────────────────────────────────────────────

export type ScheduleType = 'cron' | 'interval' | 'event_driven';
export type ScheduleTriggerType = ScheduleType;

export interface CronFieldMatchRules {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}
export type CronRules = CronFieldMatchRules;

export interface SkillScheduleConfig {
  type: ScheduleType;
  /** Cron expression (e.g. "0 6 * * *") when type === 'cron' */
  expression?: string;
  /** Interval in seconds when type === 'interval' (e.g. 14400 for 4h) */
  intervalSeconds?: number;
  /** Event trigger name when type === 'event_driven' (e.g. "video_ready") */
  eventTrigger?: string;
  timezone: string; // e.g. "UTC" or "Asia/Ho_Chi_Minh"
}

export interface SkillResourceLimits {
  memoryLimitMb: number;
  timeoutSeconds: number;
  maxRetries: number;
}

export type AutonomousCapability =
  | 'affiliate-scout'
  | 'content-producer'
  | 'auto-publisher';

export interface AutonomousSkillDefinition {
  name: AutonomousCapability | string;
  description: string;
  enabled: boolean;
  tierRequirement: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  schedule: SkillScheduleConfig;
  resources: SkillResourceLimits;
  dependencies: string[];
  priority: number; // 1 = highest, 3 = lowest
}

export interface ScheduledTaskExecution {
  taskId: string;
  skillName: string;
  scheduledTime: number;
  attemptNumber: number;
  payload: Record<string, unknown>;
  priority?: number;
}

// ── 3. Circuit Breaker & Retry Types ────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type CircuitStatus = CircuitState;

export interface CircuitBreakerStatus {
  serviceOrSkill: string;
  state: CircuitState;
  consecutiveFailures: number;
  failureThreshold: number;
  cooldownPeriodMs: number;
  lastFailureAt: number | null;
  lastStateChangeAt: number;
}

export interface CircuitEvaluationResult {
  status: CircuitStatus;
  allowRequest: boolean;
  tripped: boolean;
  recovered: boolean;
  cooldownRemainingMs: number;
}

export interface BackoffConfig {
  baseDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitterPct: number;
}
export type RetryConfig = BackoffConfig & {
  maxRetries: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
};

export interface RetryEvaluation {
  shouldRetry: boolean;
  nextAttempt: number;
  delayMs: number;
  nextRunAtMs: number;
  exhausted: boolean;
}

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

