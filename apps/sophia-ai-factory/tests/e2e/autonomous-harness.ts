/**
 * Opaque-Box E2E Test Harness — Autonomous AGI Loop Control
 * (mk-autonomous / CHÚA CHÙM 24/7 Agent Swarm & Heartbeat Scheduler)
 *
 * Implements the contract specifications from PROJECT.md and ORIGINAL_REQUEST.md:
 * - R1: Autonomous Loop Engine & Heartbeat Scheduler (Deterministic FSM, cron/interval evaluator, retry backoff, circuit breaker, DLQ)
 * - R2: Autonomous Agent Swarm & Governance Enforcement (Swarm dispatch: Affiliate Scout, Content Producer, Auto-Publisher; MCU & token caps; D1 audit logs)
 * - R3: Operations Cockpit Controls & Telemetry (Start, Pause, Resume, Force Cycle, Emergency Halt, Circuit Reset, DLQ Replay)
 * - R4: Clean 4-Layer Architecture & Production Invariants
 *
 * Built on deterministic in-memory SQLite (node:sqlite) and authentic Tree domain engines.
 * Zero external network dependencies, zero flaky mocks.
 *
 * @module tests/e2e/autonomous-harness
 */

import { createRequire } from 'node:module';
import type {
  AutonomousEngineState,
  AutonomousStateEvent,
  AutonomousCapability,
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousCycleRunRow,
  AutonomousDeadLetterQueueRow,
  AutonomousCycleTelemetry,
} from '@/seed/types/autonomous-engine';

import {
  transitionAutonomousState,
  canTransition,
  AutonomousStateTransitionError,
  AutonomousEngineError,
} from '@/tree/autonomous/state-machine';

import {
  parseCronExpression,
  isCronDue,
  calculateNextCronRun,
  isTaskDue,
} from '@/tree/autonomous/cron-evaluator';

import {
  calculateBackoff,
  DEFAULT_BACKOFF_CONFIG,
  type BackoffEvaluationOptions,
} from '@/tree/autonomous/retry-backoff';

import {
  createInitialCircuitStatus,
  evaluateCircuitStatus,
  isCircuitAvailable,
  getRemainingCooldownMs,
  DEFAULT_CIRCUIT_CONFIG,
} from '@/tree/autonomous/circuit-breaker';

import {
  sortScheduleTasks,
  sortTasksByPriority,
  validatePipelineDependencies,
  DEFAULT_SKILL_DEPENDENCIES,
  DEFAULT_SKILL_PRIORITIES,
} from '@/tree/autonomous/task-pipeline';

import {
  executeSwarmTask,
  canExecuteCapability,
  type SwarmExecutionContext,
  type SwarmExecutionResult,
} from '@/tree/autonomous/swarm-orchestrator';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

export function calculateNextIntervalRun(
  intervalSeconds: number,
  from: Date = new Date(),
): Date {
  const safe = Math.max(1, intervalSeconds);
  return new Date(from.getTime() + safe * 1000);
}

export function buildDeadLetterEntry(
  task: AutonomousScheduleTaskRow,
  payload: Record<string, unknown>,
  lastError: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): AutonomousDeadLetterQueueRow {
  const nonce = Math.random().toString(36).slice(2, 7);
  return {
    id: `dlq-${task.id}-${nowSeconds}-${nonce}`,
    tenant_id: task.tenant_id ?? 'default',
    task_id: task.id,
    skill_name: task.skill_name,
    payload_json: JSON.stringify(payload),
    error_message: lastError,
    retry_count: 3,
    max_retries: 3,
    status: 'dead',
    first_failed_at: nowSeconds,
    last_failed_at: nowSeconds,
    resolved_at: null,
    created_at: nowSeconds,
  };
}

export interface MockAutonomousD1 {
  exec(sql: string): void;
  rawDb: InstanceType<typeof DatabaseSync>;
  getLoopState(tenantId: string): AutonomousLoopStateRow | undefined;
  updateLoopState(
    tenantId: string,
    updates: Partial<AutonomousLoopStateRow>,
    expectedVersion?: number,
  ): boolean;
  getScheduleTasks(tenantId: string): AutonomousScheduleTaskRow[];
  getScheduleTask(taskId: string): AutonomousScheduleTaskRow | undefined;
  upsertScheduleTask(task: Partial<AutonomousScheduleTaskRow> & { id: string; tenant_id: string }): void;
  insertCycleRun(run: Partial<AutonomousCycleRunRow> & { id: string; tenant_id: string }): void;
  getCycleRuns(tenantId: string, limit?: number): AutonomousCycleRunRow[];
  insertDeadLetter(entry: AutonomousDeadLetterQueueRow): void;
  getDeadLetters(tenantId: string, resolvedOnly?: boolean): AutonomousDeadLetterQueueRow[];
  resolveDeadLetter(id: string): boolean;
}

export const AUTONOMOUS_D1_SCHEMA = `
CREATE TABLE IF NOT EXISTS autonomous_loop_state (
  tenant_id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'IDLE',
  current_cycle_id TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS autonomous_schedule_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  capability_name TEXT,
  schedule_type TEXT NOT NULL,
  schedule_expression TEXT,
  interval_seconds INTEGER,
  priority INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  next_run_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS autonomous_cycle_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  state_before TEXT NOT NULL,
  state_after TEXT NOT NULL,
  tasks_attempted INTEGER NOT NULL DEFAULT 0,
  tasks_succeeded INTEGER NOT NULL DEFAULT 0,
  tasks_failed INTEGER NOT NULL DEFAULT 0,
  mcu_consumed INTEGER NOT NULL DEFAULT 0,
  tokens_consumed INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS autonomous_dead_letter_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'dead',
  first_failed_at INTEGER NOT NULL,
  last_failed_at INTEGER NOT NULL,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL
);
`;

export function createAutonomousTestD1(): MockAutonomousD1 {
  const rawDb = new DatabaseSync(':memory:');
  rawDb.exec(AUTONOMOUS_D1_SCHEMA);

  const now = Math.floor(Date.now() / 1000);

  // Seed default tenant
  rawDb.prepare(`
    INSERT INTO autonomous_loop_state (tenant_id, state, current_cycle_id, consecutive_failures, last_heartbeat_at, version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('default', 'IDLE', null, 0, now, 1, now);

  // Seed default scheduled tasks
  const insertTask = rawDb.prepare(`
    INSERT INTO autonomous_schedule_tasks (
      id, tenant_id, skill_name, capability_name, schedule_type, schedule_expression, interval_seconds, priority, enabled, next_run_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTask.run(
    'task-affiliate-scout',
    'default',
    'affiliate-scout',
    'affiliate-scout',
    'interval',
    null,
    14400,
    3,
    1,
    now,
    now,
    now,
  );

  insertTask.run(
    'task-content-producer',
    'default',
    'content-producer',
    'content-producer',
    'cron',
    '0 6 * * *',
    null,
    2,
    1,
    now,
    now,
    now,
  );

  insertTask.run(
    'task-auto-publisher',
    'default',
    'auto-publisher',
    'auto-publisher',
    'event_driven',
    null,
    300,
    1,
    1,
    now,
    now,
    now,
  );

  return {
    exec(sql: string) {
      rawDb.exec(sql);
    },
    rawDb,

    getLoopState(tenantId: string): AutonomousLoopStateRow | undefined {
      const row = rawDb
        .prepare('SELECT * FROM autonomous_loop_state WHERE tenant_id = ?')
        .get(tenantId) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      return {
        id: `state-${tenantId}`,
        tenant_id: String(row.tenant_id),
        state: row.state as AutonomousEngineState,
        current_cycle_id: row.current_cycle_id ? String(row.current_cycle_id) : null,
        consecutive_failures: Number(row.consecutive_failures),
        last_error: null,
        consciousness_score: 95,
        daily_mcu_consumed: 0,
        monthly_mcu_consumed: 0,
        daily_spend_cents: 0,
        monthly_spend_cents: 0,
        last_heartbeat_at: Number(row.last_heartbeat_at),
        version: Number(row.version),
        created_at: Number(row.updated_at),
        updated_at: Number(row.updated_at),
      };
    },

    updateLoopState(
      tenantId: string,
      updates: Partial<AutonomousLoopStateRow>,
      expectedVersion?: number,
    ): boolean {
      const current = this.getLoopState(tenantId);
      if (!current) return false;

      if (expectedVersion !== undefined && current.version !== expectedVersion) {
        return false; // CAS conflict!
      }

      const nextVersion = current.version + 1;
      const nowTs = Math.floor(Date.now() / 1000);

      const nextState = updates.state ?? current.state;
      const nextCycleId = updates.current_cycle_id !== undefined ? updates.current_cycle_id : current.current_cycle_id;
      const nextFailures = updates.consecutive_failures ?? current.consecutive_failures;
      const nextHeartbeat = updates.last_heartbeat_at ?? current.last_heartbeat_at;

      const res = rawDb.prepare(`
        UPDATE autonomous_loop_state
        SET state = ?, current_cycle_id = ?, consecutive_failures = ?, last_heartbeat_at = ?, version = ?, updated_at = ?
        WHERE tenant_id = ? AND version = ?
      `).run(
        nextState,
        nextCycleId,
        nextFailures,
        nextHeartbeat,
        nextVersion,
        nowTs,
        tenantId,
        current.version,
      );

      return res.changes > 0;
    },

    getScheduleTasks(tenantId: string): AutonomousScheduleTaskRow[] {
      const rows = rawDb
        .prepare('SELECT * FROM autonomous_schedule_tasks WHERE tenant_id = ? ORDER BY priority ASC, next_run_at ASC')
        .all(tenantId) as Record<string, unknown>[];
      return rows.map((r) => ({
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        skill_name: String(r.skill_name),
        capability_name: (r.capability_name ?? r.skill_name) as AutonomousCapability,
        schedule_type: r.schedule_type as 'cron' | 'interval' | 'event_driven',
        schedule_expression: r.schedule_expression ? String(r.schedule_expression) : null,
        interval_seconds: r.interval_seconds !== null ? Number(r.interval_seconds) : null,
        event_trigger: null,
        timezone: 'UTC',
        tier_requirement: 'BASIC',
        priority: Number(r.priority),
        enabled: Number(r.enabled),
        last_run_at: null,
        next_run_at: Number(r.next_run_at),
        run_count: 0,
        failure_count: 0,
        lock_token: null,
        locked_until: null,
        created_at: Number(r.created_at),
        updated_at: Number(r.updated_at),
      }));
    },

    getScheduleTask(taskId: string): AutonomousScheduleTaskRow | undefined {
      const r = rawDb
        .prepare('SELECT * FROM autonomous_schedule_tasks WHERE id = ?')
        .get(taskId) as Record<string, unknown> | undefined;
      if (!r) return undefined;
      return {
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        skill_name: String(r.skill_name),
        capability_name: (r.capability_name ?? r.skill_name) as AutonomousCapability,
        schedule_type: r.schedule_type as 'cron' | 'interval' | 'event_driven',
        schedule_expression: r.schedule_expression ? String(r.schedule_expression) : null,
        interval_seconds: r.interval_seconds !== null ? Number(r.interval_seconds) : null,
        event_trigger: null,
        timezone: 'UTC',
        tier_requirement: 'BASIC',
        priority: Number(r.priority),
        enabled: Number(r.enabled),
        last_run_at: null,
        next_run_at: Number(r.next_run_at),
        run_count: 0,
        failure_count: 0,
        lock_token: null,
        locked_until: null,
        created_at: Number(r.created_at),
        updated_at: Number(r.updated_at),
      };
    },

    upsertScheduleTask(task: Partial<AutonomousScheduleTaskRow> & { id: string; tenant_id: string }): void {
      const existing = this.getScheduleTask(task.id);
      const nowTs = Math.floor(Date.now() / 1000);
      if (existing) {
        rawDb.prepare(`
          UPDATE autonomous_schedule_tasks
          SET capability_name = ?, schedule_type = ?, schedule_expression = ?, interval_seconds = ?, priority = ?, enabled = ?, next_run_at = ?, updated_at = ?
          WHERE id = ?
        `).run(
          task.capability_name ?? existing.capability_name,
          task.schedule_type ?? existing.schedule_type,
          task.schedule_expression !== undefined ? task.schedule_expression : existing.schedule_expression,
          task.interval_seconds !== undefined ? task.interval_seconds : existing.interval_seconds,
          task.priority ?? existing.priority,
          task.enabled ?? existing.enabled,
          task.next_run_at ?? existing.next_run_at,
          nowTs,
          task.id,
        );
      } else {
        rawDb.prepare(`
          INSERT INTO autonomous_schedule_tasks (
            id, tenant_id, skill_name, capability_name, schedule_type, schedule_expression, interval_seconds, priority, enabled, next_run_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.id,
          task.tenant_id,
          task.skill_name ?? task.capability_name ?? 'affiliate-scout',
          task.capability_name ?? 'affiliate-scout',
          task.schedule_type ?? 'interval',
          task.schedule_expression ?? null,
          task.interval_seconds ?? 3600,
          task.priority ?? 1,
          task.enabled ?? 1,
          task.next_run_at ?? nowTs,
          nowTs,
          nowTs,
        );
      }
    },

    insertCycleRun(run: Partial<AutonomousCycleRunRow> & { id: string; tenant_id: string }): void {
      rawDb.prepare(`
        INSERT INTO autonomous_cycle_runs (
          id, tenant_id, trigger_type, state_before, state_after, tasks_attempted, tasks_succeeded, tasks_failed, mcu_consumed, tokens_consumed, duration_ms, error_summary, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        run.id,
        run.tenant_id,
        run.trigger_type ?? 'scheduler',
        run.state_before ?? 'IDLE',
        run.state_after ?? 'IDLE',
        run.tasks_attempted ?? 0,
        run.tasks_succeeded ?? 0,
        run.tasks_failed ?? 0,
        run.mcu_consumed ?? 0,
        run.tokens_consumed ?? 0,
        run.duration_ms ?? 0,
        run.error_summary ?? null,
        run.created_at ?? Math.floor(Date.now() / 1000),
      );
    },

    getCycleRuns(tenantId: string, limit: number = 20): AutonomousCycleRunRow[] {
      const rows = rawDb
        .prepare('SELECT * FROM autonomous_cycle_runs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?')
        .all(tenantId, limit) as Record<string, unknown>[];
      return rows.map((r) => ({
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        trigger_type: String(r.trigger_type),
        state_before: r.state_before as AutonomousEngineState,
        state_after: r.state_after as AutonomousEngineState,
        tasks_attempted: Number(r.tasks_attempted),
        tasks_succeeded: Number(r.tasks_succeeded),
        tasks_failed: Number(r.tasks_failed),
        mcu_consumed: Number(r.mcu_consumed),
        tokens_consumed: Number(r.tokens_consumed),
        cost_cents: 0,
        consciousness_score: 95,
        duration_ms: Number(r.duration_ms),
        error_summary: r.error_summary ? String(r.error_summary) : null,
        created_at: Number(r.created_at),
      }));
    },

    insertDeadLetter(entry: AutonomousDeadLetterQueueRow): void {
      rawDb.prepare(`
        INSERT INTO autonomous_dead_letter_queue (
          id, tenant_id, task_id, skill_name, payload_json, error_message, retry_count, max_retries, status, first_failed_at, last_failed_at, resolved_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.id,
        entry.tenant_id ?? 'default',
        entry.task_id,
        entry.skill_name,
        entry.payload_json ? entry.payload_json.replace(/\0/g, '') : '',
        entry.error_message ? entry.error_message.replace(/\0/g, '') : '',
        entry.retry_count,
        entry.max_retries,
        entry.status,
        entry.first_failed_at,
        entry.last_failed_at,
        entry.resolved_at,
        entry.created_at,
      );
    },

    getDeadLetters(tenantId: string, resolvedOnly: boolean = false): AutonomousDeadLetterQueueRow[] {
      const sql = resolvedOnly
        ? "SELECT * FROM autonomous_dead_letter_queue WHERE tenant_id = ? AND status = 'resolved' ORDER BY last_failed_at DESC"
        : "SELECT * FROM autonomous_dead_letter_queue WHERE tenant_id = ? AND status != 'resolved' ORDER BY last_failed_at DESC";
      const rows = rawDb.prepare(sql).all(tenantId) as Record<string, unknown>[];
      return rows.map((r) => ({
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        task_id: String(r.task_id),
        skill_name: String(r.skill_name),
        payload_json: String(r.payload_json),
        error_message: String(r.error_message),
        error_stack: null,
        retry_count: Number(r.retry_count),
        max_retries: Number(r.max_retries),
        status: r.status as 'dead' | 'retrying' | 'resolved' | 'purged',
        first_failed_at: Number(r.first_failed_at),
        last_failed_at: Number(r.last_failed_at),
        resolved_at: r.resolved_at ? Number(r.resolved_at) : null,
        created_at: Number(r.created_at),
      }));
    },

    resolveDeadLetter(id: string): boolean {
      const now = Math.floor(Date.now() / 1000);
      const res = rawDb
        .prepare("UPDATE autonomous_dead_letter_queue SET status = 'resolved', resolved_at = ? WHERE id = ?")
        .run(now, id);
      return res.changes > 0;
    },
  };
}

// ─── Autonomous Loop Execution Orchestrator for Opaque-Box E2E Testing ───────

export interface RunCycleOptions {
  tenantId?: string;
  triggeredBy?: string;
  force?: boolean;
  availableMcu?: number;
  maxTokensPerCycle?: number;
  mockFailureTaskIds?: string[];
  mockFatalError?: string;
  nowSeconds?: number;
}

export function executeFullAutonomousCycle(
  db: MockAutonomousD1,
  options: RunCycleOptions = {},
): AutonomousCycleTelemetry {
  const tenantId = options.tenantId ?? 'default';
  const triggeredBy = options.triggeredBy ?? 'scheduler';
  const availableMcu = options.availableMcu ?? 1000;
  const maxTokensPerCycle = options.maxTokensPerCycle ?? 50000;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const cycleId = `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startTime = Date.now();

  const stateRow = db.getLoopState(tenantId);
  if (!stateRow) {
    throw new Error(`Tenant state row not found for ${tenantId}`);
  }

  const stateBefore = stateRow.state;

  // 1. Evaluate State Transition to RUNNING
  let transitionEvent: AutonomousStateEvent = 'TRIGGER_CYCLE';
  if (stateBefore === 'PAUSED' && options.force) {
    transitionEvent = 'FORCE_CYCLE_CMD';
  } else if (stateBefore === 'IDLE') {
    transitionEvent = 'TRIGGER_CYCLE';
  } else if (stateBefore === 'RECOVERING') {
    transitionEvent = 'RECOVERY_SUCCESS';
  } else if (stateBefore === 'CIRCUIT_BROKEN') {
    if (options.force) {
      transitionEvent = 'COOLDOWN_EXPIRED';
    } else {
      transitionEvent = 'TRIGGER_CYCLE'; // will be rejected
    }
  }

  if (!canTransition(stateBefore, transitionEvent)) {
    return {
      cycleId,
      tenantId,
      startedAt: startTime,
      completedAt: Date.now(),
      stateBefore,
      stateAfter: stateBefore,
      tasksAttempted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      mcuConsumed: 0,
      tokensConsumed: 0,
      costEstimateUsd: 0,
      consciousnessScore: 95,
      durationMs: Date.now() - startTime,
      errorSummary: `Invalid transition: Cannot process '${transitionEvent}' while in '${stateBefore}' state`,
    };
  }

  let startTransition;
  try {
    startTransition = transitionAutonomousState(stateBefore, transitionEvent, {
      consecutiveFailures: stateRow.consecutive_failures,
      isForceCycle: options.force,
      now: Date.now(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      cycleId,
      tenantId,
      startedAt: startTime,
      completedAt: Date.now(),
      stateBefore,
      stateAfter: stateBefore,
      tasksAttempted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      mcuConsumed: 0,
      tokensConsumed: 0,
      costEstimateUsd: 0,
      consciousnessScore: 95,
      durationMs: Date.now() - startTime,
      errorSummary: errorMsg,
    };
  }

  // Update loop state via CAS
  const acquiredLease = db.updateLoopState(
    tenantId,
    {
      state: startTransition.nextState,
      current_cycle_id: cycleId,
      last_heartbeat_at: nowSeconds,
    },
    stateRow.version,
  );

  if (!acquiredLease) {
    return {
      cycleId,
      tenantId,
      startedAt: startTime,
      completedAt: Date.now(),
      stateBefore,
      stateAfter: stateBefore,
      tasksAttempted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      mcuConsumed: 0,
      tokensConsumed: 0,
      costEstimateUsd: 0,
      consciousnessScore: 95,
      durationMs: Date.now() - startTime,
      errorSummary: 'CAS lease contention: version conflict while acquiring loop lock',
    };
  }

  // 2. Fetch and Prioritize Tasks
  const allTasks = db.getScheduleTasks(tenantId);
  const dueTasks = options.force
    ? allTasks.filter((t) => t.enabled === 1)
    : allTasks.filter((t) => isTaskDue(t, nowSeconds * 1000));

  const prioritized = sortScheduleTasks(dueTasks);

  if (prioritized.length === 0) {
    // Transition back to IDLE
    const endTransition = transitionAutonomousState(startTransition.nextState, 'NO_TASKS_DUE');
    db.updateLoopState(tenantId, {
      state: endTransition.nextState,
      current_cycle_id: null,
      last_heartbeat_at: nowSeconds,
    });

    return {
      cycleId,
      tenantId,
      startedAt: startTime,
      completedAt: Date.now(),
      stateBefore,
      stateAfter: endTransition.nextState,
      tasksAttempted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      mcuConsumed: 0,
      tokensConsumed: 0,
      costEstimateUsd: 0,
      consciousnessScore: 95,
      durationMs: Date.now() - startTime,
      errorSummary: null,
    };
  }

  // 3. Execute Swarm Tasks with Governance & Budget Bounds
  let currentMcuRemaining = availableMcu;
  let totalMcuConsumed = 0;
  let totalTokensUsed = 0;
  let tasksSucceeded = 0;
  let tasksFailed = 0;
  const errors: string[] = [];
  let hadTaskFailure = false;

  for (const task of prioritized) {
    const isMockFailed = options.mockFailureTaskIds?.includes(task.id);
    const swarmContext: SwarmExecutionContext = {
      tenantId,
      availableMcu: currentMcuRemaining,
      maxTokensPerCycle,
    };

    if (options.mockFatalError) {
      hadTaskFailure = true;
      tasksFailed++;
      errors.push(options.mockFatalError);
      break;
    }

    if (isMockFailed) {
      hadTaskFailure = true;
      tasksFailed++;
      const errorMsg = `Task ${task.id} failed due to simulated network timeout`;
      errors.push(errorMsg);

      // Evaluate backoff
      const backoff = calculateBackoff(3, DEFAULT_BACKOFF_CONFIG);
      if (backoff.exhausted) {
        // Enqueue to DLQ
        const dlqEntry = buildDeadLetterEntry(
          task,
          { capability: task.capability_name, reason: 'exhausted' },
          errorMsg,
          nowSeconds,
        );
        db.insertDeadLetter(dlqEntry);
      }
      continue;
    }

    const execResult: SwarmExecutionResult = executeSwarmTask(task, swarmContext);

    if (execResult.success) {
      tasksSucceeded++;
      totalMcuConsumed += execResult.mcuConsumed;
      totalTokensUsed += execResult.tokensUsed;
      currentMcuRemaining -= execResult.mcuConsumed;

      // Update next_run_at for schedule task
      let nextRun = nowSeconds + 3600;
      if (task.schedule_type === 'interval' && task.interval_seconds) {
        nextRun = Math.floor(calculateNextIntervalRun(task.interval_seconds, new Date(nowSeconds * 1000)).getTime() / 1000);
      } else if (task.schedule_type === 'cron' && task.schedule_expression) {
        try {
          const nextDate = calculateNextCronRun(task.schedule_expression, new Date(nowSeconds * 1000));
          nextRun = Math.floor(nextDate.getTime() / 1000);
        } catch {
          nextRun = nowSeconds + 86400;
        }
      }

      db.upsertScheduleTask({
        id: task.id,
        tenant_id: tenantId,
        next_run_at: nextRun,
      });
    } else {
      hadTaskFailure = true;
      tasksFailed++;
      errors.push(execResult.error ?? 'Unknown capability failure');
    }
  }

  // 4. Resolve Final FSM State Transition
  const latestStateRow = db.getLoopState(tenantId)!;
  const currentFailures = latestStateRow.consecutive_failures;

  let finalEvent: AutonomousStateEvent = 'CYCLE_SUCCESS';
  if (options.mockFatalError?.includes('budget') || currentMcuRemaining <= 0 && errors.length > 0) {
    finalEvent = 'BUDGET_EXCEEDED';
  } else if (hadTaskFailure) {
    if (currentFailures + 1 >= 5) {
      finalEvent = 'CONSECUTIVE_FAILURES';
    } else {
      finalEvent = 'TASK_FAILURE';
    }
  }

  let endTransition;
  if (startTransition.nextState === 'RECOVERING' && !hadTaskFailure) {
    const recoverStep = transitionAutonomousState('RECOVERING', 'RECOVERY_SUCCESS');
    endTransition = transitionAutonomousState(recoverStep.nextState, 'CYCLE_SUCCESS');
  } else {
    endTransition = transitionAutonomousState(startTransition.nextState, finalEvent, {
      consecutiveFailures: currentFailures,
    });
  }

  const nextFailures = endTransition.resetFailureCount
    ? 0
    : hadTaskFailure
      ? currentFailures + 1
      : currentFailures;

  db.updateLoopState(tenantId, {
    state: endTransition.nextState,
    current_cycle_id: null,
    consecutive_failures: nextFailures,
    last_heartbeat_at: nowSeconds,
  });

  const durationMs = Date.now() - startTime;

  db.insertCycleRun({
    id: cycleId,
    tenant_id: tenantId,
    trigger_type: triggeredBy,
    state_before: stateBefore,
    state_after: endTransition.nextState,
    tasks_attempted: tasksSucceeded + tasksFailed,
    tasks_succeeded: tasksSucceeded,
    tasks_failed: tasksFailed,
    mcu_consumed: totalMcuConsumed,
    tokens_consumed: totalTokensUsed,
    duration_ms: durationMs,
    error_summary: errors.length > 0 ? errors.join('; ') : null,
    created_at: nowSeconds,
  });

  return {
    cycleId,
    tenantId,
    startedAt: startTime,
    completedAt: Date.now(),
    stateBefore,
    stateAfter: endTransition.nextState,
    tasksAttempted: tasksSucceeded + tasksFailed,
    tasksSucceeded,
    tasksFailed,
    mcuConsumed: totalMcuConsumed,
    tokensConsumed: totalTokensUsed,
    costEstimateUsd: totalMcuConsumed * 0.005,
    consciousnessScore: 95,
    durationMs,
    errorSummary: errors.length > 0 ? errors.join('; ') : null,
  };
}

// ─── Operations Cockpit Action Simulated Handlers ────────────────────────────

export function pauseAutonomousLoop(
  db: MockAutonomousD1,
  tenantId: string = 'default',
  reason: string = 'Operator paused loop',
): { success: boolean; state: AutonomousEngineState } {
  const current = db.getLoopState(tenantId);
  if (!current) return { success: false, state: 'IDLE' };

  if (!canTransition(current.state, 'PAUSE_CMD')) {
    return { success: false, state: current.state };
  }

  const transition = transitionAutonomousState(current.state, 'PAUSE_CMD', {
    pauseReason: reason,
    consecutiveFailures: current.consecutive_failures,
  });

  db.updateLoopState(tenantId, { state: transition.nextState });
  return { success: true, state: transition.nextState };
}

export function resumeAutonomousLoop(
  db: MockAutonomousD1,
  tenantId: string = 'default',
): { success: boolean; state: AutonomousEngineState } {
  const current = db.getLoopState(tenantId);
  if (!current) return { success: false, state: 'IDLE' };

  if (!canTransition(current.state, 'RESUME_CMD')) {
    return { success: false, state: current.state };
  }

  const transition = transitionAutonomousState(current.state, 'RESUME_CMD', {
    consecutiveFailures: current.consecutive_failures,
  });

  db.updateLoopState(tenantId, { state: transition.nextState });
  return { success: true, state: transition.nextState };
}

export function emergencyHaltAutonomousLoop(
  db: MockAutonomousD1,
  tenantId: string = 'default',
): { success: boolean; state: AutonomousEngineState } {
  const current = db.getLoopState(tenantId);
  if (!current) return { success: false, state: 'IDLE' };

  const transition = transitionAutonomousState(current.state, 'EMERGENCY_HALT', {
    consecutiveFailures: current.consecutive_failures,
  });

  db.updateLoopState(tenantId, { state: transition.nextState });
  return { success: true, state: transition.nextState };
}

export function resetCircuitBreaker(
  db: MockAutonomousD1,
  tenantId: string = 'default',
): { success: boolean; state: AutonomousEngineState } {
  const current = db.getLoopState(tenantId);
  if (!current) return { success: false, state: 'IDLE' };

  let event: AutonomousStateEvent = 'MANUAL_RESET';
  if (current.state === 'PAUSED') {
    event = 'RESUME_CMD';
  } else if (current.state === 'CIRCUIT_BROKEN' || current.state === 'IDLE') {
    event = 'MANUAL_RESET';
  }

  const transition = transitionAutonomousState(current.state, event, {
    consecutiveFailures: 0,
  });

  db.updateLoopState(tenantId, {
    state: transition.nextState,
    consecutive_failures: 0,
  });
  return { success: true, state: transition.nextState };
}

export function replayDeadLetterQueueTask(
  db: MockAutonomousD1,
  tenantId: string,
  dlqId: string,
): { success: boolean; replayedTaskId?: string } {
  const letters = db.getDeadLetters(tenantId, false);
  const target = letters.find((l) => l.id === dlqId);
  if (!target) return { success: false };

  db.resolveDeadLetter(dlqId);
  const nowTs = Math.floor(Date.now() / 1000);

  db.upsertScheduleTask({
    id: target.task_id,
    tenant_id: tenantId,
    enabled: 1,
    next_run_at: nowTs,
  });

  return { success: true, replayedTaskId: target.task_id };
}
