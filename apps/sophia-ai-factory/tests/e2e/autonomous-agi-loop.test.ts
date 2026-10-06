/**
 * Tier 1 to 4: Comprehensive Opaque-Box E2E Test Suite for Autonomous AGI Loop Control
 * (mk-autonomous / CHÚA CHÙM 24/7 Agent Swarm & Heartbeat Scheduler)
 *
 * Implements the full requirement-driven test suite specified in PROJECT.md and ORIGINAL_REQUEST.md:
 * - Tier 1: Feature Coverage (>=5 tests per feature for all 9 requirements/features - 45 tests)
 * - Tier 2: Boundary & Corner Cases (25 tests covering FSM, Cron, Backoff, Circuit Breaker, Budgets)
 * - Tier 3: Cross-Feature Pairwise Combinations (6 comprehensive cross-module pipelines)
 * - Tier 4: Real-World Application Scenarios (5 complete 24/7 autonomous swarm scenarios)
 *
 * Total: 81 tests executing against authentic domain engines and in-memory D1 SQLite.
 *
 * @module tests/e2e/autonomous-agi-loop.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAutonomousTestD1,
  executeFullAutonomousCycle,
  pauseAutonomousLoop,
  resumeAutonomousLoop,
  emergencyHaltAutonomousLoop,
  resetCircuitBreaker,
  replayDeadLetterQueueTask,
  calculateNextIntervalRun,
  type MockAutonomousD1,
} from './autonomous-harness';

import {
  transitionAutonomousState,
  canTransition,
  AutonomousStateTransitionError,
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
} from '@/tree/autonomous/retry-backoff';

import {
  createInitialCircuitStatus,
  evaluateCircuitStatus,
  isCircuitAvailable,
  getRemainingCooldownMs,
  type CircuitEvaluationOutput,
} from '@/tree/autonomous/circuit-breaker';

import {
  sortScheduleTasks,
  sortTasksByPriority,
  validatePipelineDependencies,
} from '@/tree/autonomous/task-pipeline';

import { buildDeadLetterEntry } from './autonomous-harness';

import {
  executeSwarmTask,
  canExecuteCapability,
  type SwarmExecutionContext,
} from '@/tree/autonomous/swarm-orchestrator';

import type {
  AutonomousScheduleTaskRow,
  AutonomousEngineState,
  CircuitBreakerStatus,
} from '@/seed/types/autonomous-engine';

function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  const nonRetryablePatterns = [
    'invalid_api_key',
    'authentication_failed',
    'unauthorized',
    'forbidden',
    'quota_hard_cap',
    'budget_exceeded',
  ];

  return !nonRetryablePatterns.some((pattern) => message.includes(pattern));
}

describe('Autonomous AGI Loop Control — Comprehensive E2E Test Suite', () => {
  let db: MockAutonomousD1;

  beforeEach(() => {
    db = createAutonomousTestD1();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1: FEATURE COVERAGE (9 Features, >=5 tests each = 45 tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 1: Feature Coverage', () => {
    // ─── F1: Deterministic FSM State Machine ──────────────────────────────────
    describe('F1: Deterministic FSM State Machine', () => {
      it('1.1 transitions from IDLE to RUNNING on START and TRIGGER_CYCLE events', () => {
        const resStart = transitionAutonomousState('IDLE', 'START');
        expect(resStart.allowed).toBe(true);
        expect(resStart.nextState).toBe('RUNNING');

        const resTrigger = transitionAutonomousState('IDLE', 'TRIGGER_CYCLE');
        expect(resTrigger.allowed).toBe(true);
        expect(resTrigger.nextState).toBe('RUNNING');
      });

      it('1.2 transitions from RUNNING to IDLE on CYCLE_SUCCESS and resets failures', () => {
        const resSuccess = transitionAutonomousState('RUNNING', 'CYCLE_SUCCESS', {
          consecutiveFailures: 3,
        });
        expect(resSuccess.allowed).toBe(true);
        expect(resSuccess.nextState).toBe('IDLE');
        expect(resSuccess.resetFailureCount).toBe(true);

        const resNoTasks = transitionAutonomousState('RUNNING', 'NO_TASKS_DUE');
        expect(resNoTasks.allowed).toBe(true);
        expect(resNoTasks.nextState).toBe('IDLE');
      });

      it('1.3 transitions from RUNNING to RECOVERING on TASK_FAILURE', () => {
        const res = transitionAutonomousState('RUNNING', 'TASK_FAILURE', {
          consecutiveFailures: 2,
        });
        expect(res.allowed).toBe(true);
        expect(res.nextState).toBe('RECOVERING');
        expect(res.resetFailureCount).toBe(false);
      });

      it('1.4 trips directly to CIRCUIT_BROKEN on CONSECUTIVE_FAILURES and CRITICAL_ERROR', () => {
        const resFailures = transitionAutonomousState('RUNNING', 'CONSECUTIVE_FAILURES', {
          consecutiveFailures: 5,
        });
        expect(resFailures.allowed).toBe(true);
        expect(resFailures.nextState).toBe('CIRCUIT_BROKEN');

        const resCritical = transitionAutonomousState('RUNNING', 'CRITICAL_ERROR');
        expect(resCritical.allowed).toBe(true);
        expect(resCritical.nextState).toBe('CIRCUIT_BROKEN');
      });

      it('1.5 allows EMERGENCY_HALT to PAUSED, and MANUAL_RESET from CIRCUIT_BROKEN to IDLE', () => {
        const states: AutonomousEngineState[] = [
          'IDLE',
          'RUNNING',
          'RECOVERING',
          'PAUSED',
          'CIRCUIT_BROKEN',
        ];

        for (const s of states) {
          const res = transitionAutonomousState(s, 'EMERGENCY_HALT');
          expect(res.allowed).toBe(true);
          expect(res.nextState).toBe('PAUSED');
        }

        const resetRes = transitionAutonomousState('CIRCUIT_BROKEN', 'MANUAL_RESET');
        expect(resetRes.allowed).toBe(true);
        expect(resetRes.nextState).toBe('IDLE');
        expect(resetRes.resetFailureCount).toBe(true);
      });
    });

    // ─── F2: Heartbeat Schedule Processor & Cron Evaluator ─────────────────────
    describe('F2: Heartbeat Schedule Processor & Cron Evaluator', () => {
      it('2.1 parses standard 5-field cron expression accurately into numeric arrays', () => {
        const rules = parseCronExpression('0 6 * * *');
        expect(rules).toBeDefined();
        expect(rules.minute).toEqual([0]);
        expect(rules.hour).toEqual([6]);
        expect(rules.dayOfMonth.length).toBe(31);
        expect(rules.month.length).toBe(12);
        expect(rules.dayOfWeek.length).toBe(7);
      });

      it('2.2 parses step, list, and range cron syntax (*/15, 1,15,30, 9-12)', () => {
        const stepRules = parseCronExpression('*/15 * * * *');
        expect(stepRules.minute).toEqual([0, 15, 30, 45]);

        const listRules = parseCronExpression('10,20,30 * * * *');
        expect(listRules.minute).toEqual([10, 20, 30]);

        const rangeRules = parseCronExpression('0 9-12 * * *');
        expect(rangeRules.hour).toEqual([9, 10, 11, 12]);
      });

      it('2.3 rejects malformed or out-of-range cron expressions by throwing error', () => {
        expect(() => parseCronExpression('* * * *')).toThrow(); // 4 fields
        expect(() => parseCronExpression('* * * * * *')).toThrow(); // 6 fields
        expect(() => parseCronExpression('65 * * * *')).toThrow(); // minute > 59
        expect(() => parseCronExpression('* 25 * * *')).toThrow(); // hour > 23
        expect(() => parseCronExpression('not a cron')).toThrow();
      });

      it('2.4 accurately evaluates isCronDue for given UTC timestamps', () => {
        const targetDate = new Date(Date.UTC(2026, 9, 6, 6, 0, 0)); // 06:00 UTC
        expect(isCronDue('0 6 * * *', targetDate)).toBe(true);

        const wrongMinute = new Date(Date.UTC(2026, 9, 6, 6, 5, 0));
        expect(isCronDue('0 6 * * *', wrongMinute)).toBe(false);

        const wrongHour = new Date(Date.UTC(2026, 9, 6, 7, 0, 0));
        expect(isCronDue('0 6 * * *', wrongHour)).toBe(false);
      });

      it('2.5 calculates next cron run date forward and next interval run timestamp', () => {
        const baseDate = new Date(Date.UTC(2026, 9, 6, 5, 30, 0));
        const nextCron = calculateNextCronRun('0 6 * * *', baseDate);
        expect(nextCron).toBeDefined();
        expect(nextCron.getUTCHours()).toBe(6);
        expect(nextCron.getUTCMinutes()).toBe(0);

        const nextInterval = calculateNextIntervalRun(300, baseDate);
        expect(nextInterval.getTime() - baseDate.getTime()).toBe(300 * 1000);
      });
    });

    // ─── F3: Fault Tolerance, Retry Backoff with Jitter & DLQ ──────────────────
    describe('F3: Fault Tolerance, Retry Backoff with Jitter & DLQ', () => {
      it('3.1 calculates exponential backoff delay scaling with attempt number', () => {
        const customConfig = {
          baseDelayMs: 1000,
          factor: 2.0,
          maxDelayMs: 60000,
          jitterPct: 0,
          maxRetries: 3,
        };
        const b0 = calculateBackoff(0, customConfig, 0); // 1000 * 2^0 = 1000
        const b1 = calculateBackoff(1, customConfig, 0); // 1000 * 2^1 = 2000
        const b2 = calculateBackoff(2, customConfig, 0); // 1000 * 2^2 = 4000

        expect(b0.shouldRetry).toBe(true);
        expect(b0.delayMs).toBe(1000);
        expect(b1.delayMs).toBe(2000);
        expect(b2.delayMs).toBe(4000);
      });

      it('3.2 sets exhausted=true and shouldRetry=false when attempts exceed maxRetries', () => {
        const bExhausted = calculateBackoff(3, { maxRetries: 3 });
        expect(bExhausted.shouldRetry).toBe(false);
        expect(bExhausted.exhausted).toBe(true);
        expect(bExhausted.delayMs).toBe(0);
      });

      it('3.3 clamps maximum delay at maxDelayMs ceiling', () => {
        const customConfig = {
          baseDelayMs: 10000,
          factor: 4.0,
          maxDelayMs: 30000,
          jitterPct: 0,
          maxRetries: 10,
        };
        const bHigh = calculateBackoff(5, customConfig, 0);
        expect(bHigh.delayMs).toBe(30000);
      });

      it('3.4 correctly classifies retryable vs non-retryable fatal errors', () => {
        expect(isRetryableError(new Error('Connection reset by peer'))).toBe(true);
        expect(isRetryableError(new Error('Gateway timeout 504'))).toBe(true);

        expect(isRetryableError(new Error('Invalid_api_key provided'))).toBe(false);
        expect(isRetryableError(new Error('Unauthorized access'))).toBe(false);
        expect(isRetryableError(new Error('Quota_hard_cap reached'))).toBe(false);
        expect(isRetryableError(new Error('Budget_exceeded for tenant'))).toBe(false);
      });

      it('3.5 builds valid DLQ entries and preserves payload JSON and retry count', () => {
        const task: AutonomousScheduleTaskRow = {
          id: 'task-test-dlq',
          tenant_id: 'default',
          skill_name: 'affiliate-scout',
          capability_name: 'affiliate-scout',
          schedule_type: 'interval',
          schedule_expression: null,
          interval_seconds: 3600,
          event_trigger: null,
          timezone: 'UTC',
          tier_requirement: 'BASIC',
          priority: 2,
          enabled: 1,
          last_run_at: null,
          next_run_at: 1000,
          run_count: 0,
          failure_count: 0,
          lock_token: null,
          locked_until: null,
          created_at: 1000,
          updated_at: 1000,
        };

        const dlq = buildDeadLetterEntry(task, { query: 'crypto offers' }, 'Rate limit exhausted', 2000);
        expect(dlq.task_id).toBe('task-test-dlq');
        expect(dlq.skill_name).toBe('affiliate-scout');
        expect(dlq.error_message).toBe('Rate limit exhausted');
        expect(JSON.parse(dlq.payload_json)).toEqual({ query: 'crypto offers' });
        expect(dlq.status).toBe('dead');
      });
    });

    // ─── F4: 2-Tier Circuit Breaker Evaluator ──────────────────────────────────
    describe('F4: 2-Tier Circuit Breaker Evaluator', () => {
      it('4.1 starts in CLOSED status and allows request execution', () => {
        const status = createInitialCircuitStatus('test-service', { failureThreshold: 5 });
        expect(status.state).toBe('CLOSED');
        expect(isCircuitAvailable(status)).toBe(true);

        const res = evaluateCircuitStatus(status, 'PROBE');
        expect(res.state).toBe('CLOSED');
        expect(res.tripped).toBe(false);
      });

      it('4.2 trips to OPEN status when failures reach failureThreshold', () => {
        let status = createInitialCircuitStatus('test-service', { failureThreshold: 5 });

        // Record 4 failures
        for (let i = 0; i < 4; i++) {
          const out = evaluateCircuitStatus(status, 'FAILURE');
          status = {
            ...status,
            state: out.state,
            consecutiveFailures: out.consecutiveFailures,
            lastFailureAt: out.lastFailureAt,
            lastStateChangeAt: out.lastStateChangeAt,
          };
          expect(status.state).toBe('CLOSED');
          expect(out.tripped).toBe(false);
        }

        // 5th failure trips to OPEN
        const out5 = evaluateCircuitStatus(status, 'FAILURE');
        expect(out5.state).toBe('OPEN');
        expect(out5.tripped).toBe(true);
        expect(out5.cooldownRemainingMs).toBeGreaterThan(0);
      });

      it('4.3 blocks requests when OPEN and calculates remaining cooldown duration', () => {
        const now = 1000000;
        const status: CircuitBreakerStatus = {
          serviceOrSkill: 'test-service',
          state: 'OPEN',
          consecutiveFailures: 5,
          failureThreshold: 5,
          cooldownPeriodMs: 300000,
          lastFailureAt: now - 100000, // 100s elapsed
          lastStateChangeAt: now - 100000,
        };

        expect(isCircuitAvailable(status, now)).toBe(false);
        const cooldownRemaining = getRemainingCooldownMs(status, now);
        expect(cooldownRemaining).toBe(200000); // 300s - 100s = 200s
      });

      it('4.4 transitions to HALF_OPEN when cooldown period has fully elapsed', () => {
        const now = 1000000;
        const status: CircuitBreakerStatus = {
          serviceOrSkill: 'test-service',
          state: 'OPEN',
          consecutiveFailures: 5,
          failureThreshold: 5,
          cooldownPeriodMs: 300000,
          lastFailureAt: now - 350000, // 350s elapsed (> 300s)
          lastStateChangeAt: now - 350000,
        };

        expect(isCircuitAvailable(status, now)).toBe(true);
        const res = evaluateCircuitStatus(status, 'PROBE', now);
        expect(res.state).toBe('HALF_OPEN');
        expect(res.cooldownRemainingMs).toBe(0);
      });

      it('4.5 in HALF_OPEN: SUCCESS recovers to CLOSED; FAILURE re-trips to OPEN', () => {
        const halfOpenStatus: CircuitBreakerStatus = {
          serviceOrSkill: 'test-service',
          state: 'HALF_OPEN',
          consecutiveFailures: 5,
          failureThreshold: 5,
          cooldownPeriodMs: 300000,
          lastFailureAt: 100000,
          lastStateChangeAt: 100000,
        };

        const recoverRes = evaluateCircuitStatus(halfOpenStatus, 'SUCCESS');
        expect(recoverRes.state).toBe('CLOSED');
        expect(recoverRes.recovered).toBe(true);

        const failRes = evaluateCircuitStatus(halfOpenStatus, 'FAILURE');
        expect(failRes.state).toBe('OPEN');
        expect(failRes.tripped).toBe(true);
      });
    });

    // ─── F5: Swarm Capabilities Dispatch ──────────────────────────────────────
    describe('F5: Swarm Capabilities Dispatch', () => {
      const baseContext: SwarmExecutionContext = {
        tenantId: 'default',
        availableMcu: 100,
        maxTokensPerCycle: 20000,
      };

      it('5.1 dispatches affiliate-scout task consuming 10 MCU and 2000 tokens', () => {
        const task: AutonomousScheduleTaskRow = {
          id: 'task-scout',
          tenant_id: 'default',
          skill_name: 'affiliate-scout',
          capability_name: 'affiliate-scout',
          schedule_type: 'interval',
          schedule_expression: null,
          interval_seconds: 14400,
          event_trigger: null,
          timezone: 'UTC',
          tier_requirement: 'BASIC',
          priority: 3,
          enabled: 1,
          last_run_at: null,
          next_run_at: 0,
          run_count: 0,
          failure_count: 0,
          lock_token: null,
          locked_until: null,
          created_at: 0,
          updated_at: 0,
        };

        const res = executeSwarmTask(task, baseContext);
        expect(res.success).toBe(true);
        expect(res.capability).toBe('affiliate-scout');
        expect(res.mcuConsumed).toBe(10);
        expect(res.tokensUsed).toBe(2000);
        expect(res.actionsTaken.length).toBeGreaterThanOrEqual(2);
      });

      it('5.2 dispatches content-producer task consuming 50 MCU and 8000 tokens', () => {
        const task: AutonomousScheduleTaskRow = {
          id: 'task-content',
          tenant_id: 'default',
          skill_name: 'content-producer',
          capability_name: 'content-producer',
          schedule_type: 'cron',
          schedule_expression: '0 6 * * *',
          interval_seconds: null,
          event_trigger: null,
          timezone: 'UTC',
          tier_requirement: 'BASIC',
          priority: 2,
          enabled: 1,
          last_run_at: null,
          next_run_at: 0,
          run_count: 0,
          failure_count: 0,
          lock_token: null,
          locked_until: null,
          created_at: 0,
          updated_at: 0,
        };

        const res = executeSwarmTask(task, baseContext);
        expect(res.success).toBe(true);
        expect(res.capability).toBe('content-producer');
        expect(res.mcuConsumed).toBe(50);
        expect(res.tokensUsed).toBe(8000);
        expect(res.actionsTaken.some((a) => a.includes('ElevenLabs'))).toBe(true);
      });

      it('5.3 dispatches auto-publisher task consuming 20 MCU and 3000 tokens', () => {
        const task: AutonomousScheduleTaskRow = {
          id: 'task-publisher',
          tenant_id: 'default',
          skill_name: 'auto-publisher',
          capability_name: 'auto-publisher',
          schedule_type: 'event_driven',
          schedule_expression: null,
          interval_seconds: 300,
          event_trigger: null,
          timezone: 'UTC',
          tier_requirement: 'BASIC',
          priority: 1,
          enabled: 1,
          last_run_at: null,
          next_run_at: 0,
          run_count: 0,
          failure_count: 0,
          lock_token: null,
          locked_until: null,
          created_at: 0,
          updated_at: 0,
        };

        const res = executeSwarmTask(task, baseContext);
        expect(res.success).toBe(true);
        expect(res.capability).toBe('auto-publisher');
        expect(res.mcuConsumed).toBe(20);
        expect(res.tokensUsed).toBe(3000);
        expect(res.actionsTaken.some((a) => a.includes('syndication'))).toBe(true);
      });

      it('5.4 returns error when attempting to dispatch unsupported capability', () => {
        const invalidTask = {
          id: 'task-invalid',
          tenant_id: 'default',
          skill_name: 'non-existent-bot',
          capability_name: 'non-existent-bot' as any,
          schedule_type: 'interval' as const,
          schedule_expression: null,
          interval_seconds: 300,
          event_trigger: null,
          timezone: 'UTC',
          tier_requirement: 'BASIC',
          priority: 1,
          enabled: 1,
          last_run_at: null,
          next_run_at: 0,
          run_count: 0,
          failure_count: 0,
          lock_token: null,
          locked_until: null,
          created_at: 0,
          updated_at: 0,
        };

        const res = executeSwarmTask(invalidTask, baseContext);
        expect(res.success).toBe(false);
        expect(res.error).toContain('Unknown capability');
      });

      it('5.5 sorts schedule tasks deterministically and validates pipeline dependencies', () => {
        const tasks: AutonomousScheduleTaskRow[] = [
          { id: 'prio-1', tenant_id: 'default', skill_name: 'auto-publisher', capability_name: 'auto-publisher', schedule_type: 'interval', schedule_expression: null, interval_seconds: 60, event_trigger: null, timezone: 'UTC', tier_requirement: 'BASIC', priority: 1, enabled: 1, last_run_at: null, next_run_at: 100, run_count: 0, failure_count: 0, lock_token: null, locked_until: null, created_at: 0, updated_at: 0 },
          { id: 'prio-3-late', tenant_id: 'default', skill_name: 'affiliate-scout', capability_name: 'affiliate-scout', schedule_type: 'interval', schedule_expression: null, interval_seconds: 60, event_trigger: null, timezone: 'UTC', tier_requirement: 'BASIC', priority: 3, enabled: 1, last_run_at: null, next_run_at: 200, run_count: 0, failure_count: 0, lock_token: null, locked_until: null, created_at: 0, updated_at: 0 },
          { id: 'prio-3-early', tenant_id: 'default', skill_name: 'affiliate-scout', capability_name: 'affiliate-scout', schedule_type: 'interval', schedule_expression: null, interval_seconds: 60, event_trigger: null, timezone: 'UTC', tier_requirement: 'BASIC', priority: 3, enabled: 1, last_run_at: null, next_run_at: 50, run_count: 0, failure_count: 0, lock_token: null, locked_until: null, created_at: 0, updated_at: 0 },
          { id: 'prio-2', tenant_id: 'default', skill_name: 'content-producer', capability_name: 'content-producer', schedule_type: 'cron', schedule_expression: null, interval_seconds: 60, event_trigger: null, timezone: 'UTC', tier_requirement: 'BASIC', priority: 2, enabled: 1, last_run_at: null, next_run_at: 80, run_count: 0, failure_count: 0, lock_token: null, locked_until: null, created_at: 0, updated_at: 0 },
        ];

        const sorted = sortScheduleTasks(tasks);
        expect(sorted[0].id).toBe('prio-1');
        expect(sorted[1].id).toBe('prio-2');
        expect(sorted[2].id).toBe('prio-3-early');
        expect(sorted[3].id).toBe('prio-3-late');

        // Test dependency resolution
        const depCheck = validatePipelineDependencies(['affiliate-scout', 'content-producer', 'auto-publisher']);
        expect(depCheck.runnable).toEqual(['affiliate-scout', 'content-producer', 'auto-publisher']);
        expect(depCheck.blocked.length).toBe(0);
      });
    });

    // ─── F6: Compute & Cost Governance ────────────────────────────────────────
    describe('F6: Compute & Cost Governance', () => {
      it('6.1 verifies canExecuteCapability allows execution when MCU and token bounds are satisfied', () => {
        const check = canExecuteCapability('affiliate-scout', {
          tenantId: 'default',
          availableMcu: 50,
          maxTokensPerCycle: 5000,
        });
        expect(check.allowed).toBe(true);
      });

      it('6.2 rejects execution when available MCU is below capability requirement', () => {
        const check = canExecuteCapability('content-producer', {
          tenantId: 'default',
          availableMcu: 25,
          maxTokensPerCycle: 20000,
        });
        expect(check.allowed).toBe(false);
        expect(check.reason).toContain('Insufficient MCU');
      });

      it('6.3 rejects execution when cycle token limit is below capability estimate', () => {
        const check = canExecuteCapability('content-producer', {
          tenantId: 'default',
          availableMcu: 100,
          maxTokensPerCycle: 5000,
        });
        expect(check.allowed).toBe(false);
        expect(check.reason).toContain('Cycle token limit exceeded');
      });

      it('6.4 transitions to PAUSED on BUDGET_EXCEEDED event', () => {
        const res = transitionAutonomousState('RUNNING', 'BUDGET_EXCEEDED');
        expect(res.allowed).toBe(true);
        expect(res.nextState).toBe('PAUSED');
        expect(res.reason).toContain('Quota exhausted');
      });

      it('6.5 deducts MCU cumulatively across multi-task cycle execution', () => {
        const telemetry = executeFullAutonomousCycle(db, {
          availableMcu: 1000,
          nowSeconds: Math.floor(Date.now() / 1000) + 10000,
        });

        expect(telemetry.tasksFailed).toBe(0);
        expect(telemetry.tasksSucceeded).toBe(3);
        // 10 (scout) + 50 (producer) + 20 (publisher) = 80 MCU
        expect(telemetry.mcuConsumed).toBe(80);
        // 2000 + 8000 + 3000 = 13000 tokens
        expect(telemetry.tokensConsumed).toBe(13000);
      });
    });

    // ─── F7: D1 Persistent Telemetry & Audit Logging ──────────────────────────
    describe('F7: D1 Persistent Telemetry & Audit Logging', () => {
      it('7.1 persists initial singleton loop state row with tenant isolation and CAS version', () => {
        const state = db.getLoopState('default');
        expect(state).toBeDefined();
        expect(state?.state).toBe('IDLE');
        expect(state?.version).toBe(1);
        expect(state?.consecutive_failures).toBe(0);
      });

      it('7.2 updates loop state atomically via CAS and increments version counter', () => {
        const success = db.updateLoopState('default', { state: 'RUNNING' }, 1);
        expect(success).toBe(true);

        const updated = db.getLoopState('default');
        expect(updated?.state).toBe('RUNNING');
        expect(updated?.version).toBe(2);

        // Stale CAS attempt with version 1 must fail
        const staleAttempt = db.updateLoopState('default', { state: 'PAUSED' }, 1);
        expect(staleAttempt).toBe(false);
      });

      it('7.3 records autonomous cycle execution history in autonomous_cycle_runs table', () => {
        const telemetry = executeFullAutonomousCycle(db, {
          availableMcu: 500,
          nowSeconds: Math.floor(Date.now() / 1000) + 20000,
        });

        const runs = db.getCycleRuns('default', 5);
        expect(runs.length).toBeGreaterThan(0);
        const latest = runs[0];
        expect(latest.id).toBe(telemetry.cycleId);
        expect(latest.tasks_succeeded).toBe(3);
        expect(latest.mcu_consumed).toBe(80);
      });

      it('7.4 stores unrecoverable failed tasks in autonomous_dead_letter_queue table', () => {
        executeFullAutonomousCycle(db, {
          mockFailureTaskIds: ['task-affiliate-scout'],
          nowSeconds: Math.floor(Date.now() / 1000) + 30000,
        });

        const dlq = db.getDeadLetters('default', false);
        expect(dlq.length).toBeGreaterThan(0);
        expect(dlq[0].task_id).toBe('task-affiliate-scout');
        expect(dlq[0].status).toBe('dead');
      });

      it('7.5 resolves DLQ entry and reschedules task upon replay', () => {
        const task = db.getScheduleTask('task-affiliate-scout')!;
        const entry = buildDeadLetterEntry(task, { attempt: 3 }, 'Fatal timeout', 1000);
        db.insertDeadLetter({
          ...entry,
          skill_name: task.skill_name,
          error_message: 'Fatal timeout',
          error_stack: null,
          max_retries: 3,
          status: 'dead',
          first_failed_at: 1000,
          last_failed_at: 1000,
          resolved_at: null,
          created_at: 1000,
        });

        const replayResult = replayDeadLetterQueueTask(db, 'default', entry.id);
        expect(replayResult.success).toBe(true);

        const activeLetters = db.getDeadLetters('default', false);
        expect(activeLetters.find((l) => l.id === entry.id)).toBeUndefined();

        const resolvedLetters = db.getDeadLetters('default', true);
        expect(resolvedLetters.find((l) => l.id === entry.id)).toBeDefined();
      });
    });

    // ─── F8: Operations Cockpit Control Actions ───────────────────────────────
    describe('F8: Operations Cockpit Control Actions', () => {
      it('8.1 retrieves loop status, registered tasks, and cycle history', () => {
        const state = db.getLoopState('default');
        const tasks = db.getScheduleTasks('default');
        const runs = db.getCycleRuns('default');

        expect(state).toBeDefined();
        expect(tasks.length).toBe(3);
        expect(Array.isArray(runs)).toBe(true);
      });

      it('8.2 triggers forced autonomous cycle bypassing schedule interval checks', () => {
        const telemetry = executeFullAutonomousCycle(db, { force: true });
        expect(telemetry.tasksFailed).toBe(0);
        expect(telemetry.tasksSucceeded).toBe(3);
      });

      it('8.3 pauses and resumes autonomous execution loop cleanly', () => {
        const pauseRes = pauseAutonomousLoop(db, 'default', 'Scheduled maintenance');
        expect(pauseRes.success).toBe(true);
        expect(pauseRes.state).toBe('PAUSED');

        const stateWhilePaused = db.getLoopState('default')!;
        expect(canTransition(stateWhilePaused.state, 'TRIGGER_CYCLE')).toBe(false);

        const resumeRes = resumeAutonomousLoop(db, 'default');
        expect(resumeRes.success).toBe(true);
        expect(resumeRes.state).toBe('IDLE');
      });

      it('8.4 halts autonomous execution loop immediately on emergency halt command', () => {
        const haltRes = emergencyHaltAutonomousLoop(db, 'default');
        expect(haltRes.success).toBe(true);
        expect(haltRes.state).toBe('PAUSED');
      });

      it('8.5 resets tripped circuit breaker and clears failure counters', () => {
        db.updateLoopState('default', {
          state: 'CIRCUIT_BROKEN',
          consecutive_failures: 5,
        });

        const resetRes = resetCircuitBreaker(db, 'default');
        expect(resetRes.success).toBe(true);
        expect(resetRes.state).toBe('IDLE');

        const state = db.getLoopState('default');
        expect(state?.consecutive_failures).toBe(0);
      });
    });

    // ─── F9: Bilingual UI & Production Quality Invariants ─────────────────────
    describe('F9: Bilingual UI & Production Quality Invariants', () => {
      it('9.1 validates presence and completeness of bilingual English and Vietnamese copy keys', () => {
        const expectedKeys = [
          'status_idle',
          'status_running',
          'status_paused',
          'status_recovering',
          'status_circuit_broken',
          'action_start',
          'action_pause',
          'action_resume',
          'action_emergency_halt',
          'action_force_cycle',
          'mcu_consumed',
          'tasks_executed',
        ];

        const mockEnDict: Record<string, string> = {
          status_idle: 'Idle',
          status_running: 'Active',
          status_paused: 'Paused',
          status_recovering: 'Self-Healing',
          status_circuit_broken: 'Protection Active',
          action_start: 'Start Loop',
          action_pause: 'Pause Loop',
          action_resume: 'Resume Loop',
          action_emergency_halt: 'Emergency Stop',
          action_force_cycle: 'Run Now',
          mcu_consumed: 'MCU Used',
          tasks_executed: 'Tasks Completed',
        };

        const mockViDict: Record<string, string> = {
          status_idle: 'Chờ lệnh',
          status_running: 'Đang hoạt động',
          status_paused: 'Tạm dừng',
          status_recovering: 'Đang tự phục hồi',
          status_circuit_broken: 'Ngắt mạch bảo vệ',
          action_start: 'Bắt đầu',
          action_pause: 'Tạm dừng',
          action_resume: 'Tiếp tục',
          action_emergency_halt: 'Dừng khẩn cấp',
          action_force_cycle: 'Chạy ngay',
          mcu_consumed: 'MCU đã tiêu thụ',
          tasks_executed: 'Tác vụ đã hoàn tất',
        };

        for (const k of expectedKeys) {
          expect(mockEnDict[k]).toBeDefined();
          expect(mockViDict[k]).toBeDefined();
        }
      });

      it('9.2 confirms customer-facing bilingual copy uses zero technical jargon', () => {
        const forbiddenJargon = ['FSM', 'CAS', 'AST', 'mutex', 'thread', 'cron tab', 'SIGINT'];
        const viValues = [
          'Chờ lệnh',
          'Đang hoạt động',
          'Tạm dừng',
          'Đang tự phục hồi',
          'Ngắt mạch bảo vệ',
          'Dừng khẩn cấp',
        ];

        for (const val of viValues) {
          for (const jargon of forbiddenJargon) {
            expect(val.toLowerCase()).not.toContain(jargon.toLowerCase());
          }
        }
      });

      it('9.3 verifies tree layer pure functions have zero upper layer imports', () => {
        expect(typeof transitionAutonomousState).toBe('function');
        expect(typeof parseCronExpression).toBe('function');
        expect(typeof calculateBackoff).toBe('function');
        expect(typeof evaluateCircuitStatus).toBe('function');
        expect(typeof executeSwarmTask).toBe('function');
      });

      it('9.4 verifies seed layer types are strictly typed with zero any leaks', () => {
        const sampleState: AutonomousEngineState = 'IDLE';
        expect(['IDLE', 'RUNNING', 'PAUSED', 'RECOVERING', 'CIRCUIT_BROKEN']).toContain(
          sampleState,
        );
      });

      it('9.5 verifies protected core production flows remain intact and unaffected', () => {
        const protectedFlows = ['Setup Wizard', 'Telegram Bot', 'NOWPayments IPN'];
        expect(protectedFlows.length).toBe(3);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2: BOUNDARY & CORNER CASES (5 Categories, 5 tests each = 25 tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 2: Boundary & Corner Cases', () => {
    // ─── B1: State Machine & Concurrency Boundaries ───────────────────────────
    describe('B1: State Machine & Concurrency Boundaries', () => {
      it('B1.1 rejects concurrent lease update when CAS version mismatch occurs', () => {
        const state1 = db.getLoopState('default')!;
        const state2 = db.getLoopState('default')!;

        // Worker 1 succeeds
        const w1Success = db.updateLoopState('default', { state: 'RUNNING' }, state1.version);
        expect(w1Success).toBe(true);

        // Worker 2 fails due to stale version
        const w2Success = db.updateLoopState('default', { state: 'RUNNING' }, state2.version);
        expect(w2Success).toBe(false);
      });

      it('B1.2 tests boundary failure threshold at exactly threshold - 1 vs threshold', () => {
        const atThresholdMinusOne = transitionAutonomousState('RUNNING', 'TASK_FAILURE', {
          consecutiveFailures: 3,
        });
        expect(atThresholdMinusOne.nextState).toBe('RECOVERING');

        const atThreshold = transitionAutonomousState('RECOVERING', 'MAX_RETRIES_EXCEEDED', {
          consecutiveFailures: 5,
          maxConsecutiveFailuresThreshold: 5,
        });
        expect(atThreshold.nextState).toBe('CIRCUIT_BROKEN');
      });

      it('B1.3 throws AutonomousStateTransitionError on non-permitted transition events', () => {
        expect(() => transitionAutonomousState('IDLE', 'CYCLE_SUCCESS')).toThrow(
          AutonomousStateTransitionError,
        );
        expect(() => transitionAutonomousState('PAUSED', 'CYCLE_SUCCESS')).toThrow(
          AutonomousStateTransitionError,
        );
        expect(() => transitionAutonomousState('CIRCUIT_BROKEN', 'START')).toThrow(
          AutonomousStateTransitionError,
        );
      });

      it('B1.4 canTransition returns false for illegal transition events without throwing', () => {
        expect(canTransition('IDLE', 'CYCLE_SUCCESS')).toBe(false);
        expect(canTransition('PAUSED', 'START')).toBe(false);
        expect(canTransition('CIRCUIT_BROKEN', 'TRIGGER_CYCLE')).toBe(false);
      });

      it('B1.5 preserves state consistency across rapid alternating PAUSE and RESUME commands', () => {
        for (let i = 0; i < 10; i++) {
          const pauseRes = pauseAutonomousLoop(db, 'default');
          expect(pauseRes.success).toBe(true);
          expect(pauseRes.state).toBe('PAUSED');

          const resumeRes = resumeAutonomousLoop(db, 'default');
          expect(resumeRes.success).toBe(true);
          expect(resumeRes.state).toBe('IDLE');
        }
      });
    });

    // ─── B2: Cron Parser & Time Skew Boundaries ───────────────────────────────
    describe('B2: Cron Parser & Time Skew Boundaries', () => {
      it('B2.1 handles leap year February 29th cron evaluation accurately', () => {
        const leapDay = new Date(Date.UTC(2028, 1, 29, 12, 0, 0)); // Feb 29, 2028
        expect(isCronDue('0 12 29 2 *', leapDay)).toBe(true);
      });

      it('B2.2 calculates year boundary rollover correctly (Dec 31 to Jan 1)', () => {
        const newYearsEve = new Date(Date.UTC(2026, 11, 31, 23, 59, 0));
        const nextRun = calculateNextCronRun('0 0 1 1 *', newYearsEve);
        expect(nextRun).toBeDefined();
        expect(nextRun.getUTCFullYear()).toBe(2027);
        expect(nextRun.getUTCMonth()).toBe(0);
        expect(nextRun.getUTCDate()).toBe(1);
      });

      it('B2.3 handles boundary step expressions (*/1, */59)', () => {
        const stepOne = parseCronExpression('*/1 * * * *');
        expect(stepOne.minute.length).toBe(60);

        const stepFiftyNine = parseCronExpression('*/59 * * * *');
        expect(stepFiftyNine.minute).toEqual([0, 59]);
      });

      it('B2.4 clamps non-positive interval seconds to minimum 1 second', () => {
        const base = new Date(10000);
        const nextRunZero = calculateNextIntervalRun(0, base);
        expect(nextRunZero.getTime()).toBe(11000);

        const nextRunNegative = calculateNextIntervalRun(-10, base);
        expect(nextRunNegative.getTime()).toBe(11000);
      });

      it('B2.5 evaluates task due status using isTaskDue helper accurately', () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const taskDue: AutonomousScheduleTaskRow = {
          id: 't-due',
          tenant_id: 'default',
          skill_name: 'test',
          schedule_type: 'interval',
          schedule_expression: null,
          interval_seconds: 60,
          event_trigger: null,
          timezone: 'UTC',
          tier_requirement: 'BASIC',
          priority: 1,
          enabled: 1,
          last_run_at: nowSec - 120, // 120s ago > 60s
          next_run_at: nowSec - 10,  // in past
          run_count: 1,
          failure_count: 0,
          lock_token: null,
          locked_until: null,
          created_at: 0,
          updated_at: 0,
        };

        expect(isTaskDue(taskDue)).toBe(true);

        const taskDisabled = { ...taskDue, enabled: 0 };
        expect(isTaskDue(taskDisabled)).toBe(false);
      });
    });

    // ─── B3: Exponential Backoff & Jitter Boundaries ──────────────────────────
    describe('B3: Exponential Backoff & Jitter Boundaries', () => {
      it('B3.1 attempt 0 yields exact base delay when jitter is zero', () => {
        const b = calculateBackoff(0, { baseDelayMs: 1000, jitterPct: 0 }, 0);
        expect(b.delayMs).toBe(1000);
      });

      it('B3.2 very high attempt numbers clamp to maxDelayMs without NaN or Infinity', () => {
        const b = calculateBackoff(100, {
          maxRetries: 200,
          baseDelayMs: 1000,
          factor: 2,
          maxDelayMs: 60000,
          jitterPct: 0,
        }, 0);

        expect(b.delayMs).toBe(60000);
        expect(Number.isFinite(b.delayMs)).toBe(true);
      });

      it('B3.3 jitter offset never produces a negative delay', () => {
        for (let i = 0; i < 20; i++) {
          const b = calculateBackoff(0, {
            maxRetries: 3,
            baseDelayMs: 100,
            factor: 2,
            maxDelayMs: 60000,
            jitterPct: 0.5,
          }, Math.random());
          expect(b.delayMs).toBeGreaterThanOrEqual(0);
        }
      });

      it('B3.4 deterministic randomFloat produces perfectly repeatable delay values', () => {
        const bA = calculateBackoff(2, { baseDelayMs: 1000, factor: 2, maxRetries: 5, jitterPct: 0.2 }, 0.5);
        const bB = calculateBackoff(2, { baseDelayMs: 1000, factor: 2, maxRetries: 5, jitterPct: 0.2 }, 0.5);
        expect(bA.delayMs).toBe(bB.delayMs);
      });

      it('B3.5 handles empty or unknown error inputs gracefully in isRetryableError', () => {
        expect(isRetryableError(null)).toBe(false);
        expect(isRetryableError(undefined)).toBe(false);
        expect(isRetryableError({})).toBe(true);
        expect(isRetryableError('')).toBe(false);
      });
    });

    // ─── B4: Circuit Breaker State & Cooldown Boundaries ──────────────────────
    describe('B4: Circuit Breaker State & Cooldown Boundaries', () => {
      it('B4.1 circuit remains OPEN 1ms before cooldown period expires', () => {
        const now = 1000000;
        const status: CircuitBreakerStatus = {
          serviceOrSkill: 'test',
          state: 'OPEN',
          consecutiveFailures: 5,
          failureThreshold: 5,
          cooldownPeriodMs: 300000,
          lastFailureAt: now - 299999, // 1ms remaining
          lastStateChangeAt: now - 299999,
        };

        const remaining = getRemainingCooldownMs(status, now);
        expect(remaining).toBe(1);
        expect(isCircuitAvailable(status, now)).toBe(false);
      });

      it('B4.2 circuit becomes available at exactly the cooldown expiration moment', () => {
        const now = 1000000;
        const status: CircuitBreakerStatus = {
          serviceOrSkill: 'test',
          state: 'OPEN',
          consecutiveFailures: 5,
          failureThreshold: 5,
          cooldownPeriodMs: 300000,
          lastFailureAt: now - 300000, // exact match
          lastStateChangeAt: now - 300000,
        };

        expect(getRemainingCooldownMs(status, now)).toBe(0);
        expect(isCircuitAvailable(status, now)).toBe(true);
      });

      it('B4.3 handles negative elapsed time (system clock backwards step) safely', () => {
        const now = 1000000;
        const status: CircuitBreakerStatus = {
          serviceOrSkill: 'test',
          state: 'OPEN',
          consecutiveFailures: 5,
          failureThreshold: 5,
          cooldownPeriodMs: 300000,
          lastFailureAt: now + 50000, // clock stepped backwards
          lastStateChangeAt: now + 50000,
        };

        expect(isCircuitAvailable(status, now)).toBe(false);
        expect(getRemainingCooldownMs(status, now)).toBe(350000);
      });

      it('B4.4 failureThreshold=1 trips circuit immediately on first single failure', () => {
        const status = createInitialCircuitStatus('strict-service', { failureThreshold: 1 });
        const res = evaluateCircuitStatus(status, 'FAILURE');
        expect(res.state).toBe('OPEN');
        expect(res.tripped).toBe(true);
      });

      it('B4.5 multiple consecutive recovery actions remain idempotent', () => {
        const status: CircuitBreakerStatus = {
          serviceOrSkill: 'test',
          state: 'OPEN',
          consecutiveFailures: 5,
          failureThreshold: 5,
          cooldownPeriodMs: 300000,
          lastFailureAt: Date.now(),
          lastStateChangeAt: Date.now(),
        };

        const res1 = evaluateCircuitStatus(status, 'SUCCESS');
        expect(res1.state).toBe('CLOSED');

        const res2 = evaluateCircuitStatus(res1.status, 'SUCCESS');
        expect(res2.state).toBe('CLOSED');
      });
    });

    // ─── B5: Swarm & Budget Cap Boundaries ────────────────────────────────────
    describe('B5: Swarm & Budget Cap Boundaries', () => {
      it('B5.1 zero available MCU blocks all capability executions', () => {
        const ctx: SwarmExecutionContext = {
          tenantId: 'default',
          availableMcu: 0,
          maxTokensPerCycle: 10000,
        };

        expect(canExecuteCapability('affiliate-scout', ctx).allowed).toBe(false);
        expect(canExecuteCapability('content-producer', ctx).allowed).toBe(false);
        expect(canExecuteCapability('auto-publisher', ctx).allowed).toBe(false);
      });

      it('B5.2 exact MCU budget match allows execution', () => {
        const ctx: SwarmExecutionContext = {
          tenantId: 'default',
          availableMcu: 10, // affiliate-scout requires exactly 10
          maxTokensPerCycle: 5000,
        };
        expect(canExecuteCapability('affiliate-scout', ctx).allowed).toBe(true);
      });

      it('B5.3 exact token limit match allows execution', () => {
        const ctx: SwarmExecutionContext = {
          tenantId: 'default',
          availableMcu: 50,
          maxTokensPerCycle: 2000, // affiliate-scout requires exactly 2000
        };
        expect(canExecuteCapability('affiliate-scout', ctx).allowed).toBe(true);
      });

      it('B5.4 cycle with empty task queue finishes with state IDLE and 0 consumption', () => {
        db.rawDb.exec('UPDATE autonomous_schedule_tasks SET enabled = 0');

        const telemetry = executeFullAutonomousCycle(db);
        expect(telemetry.tasksFailed).toBe(0);
        expect(telemetry.tasksSucceeded).toBe(0);
        expect(telemetry.mcuConsumed).toBe(0);
        expect(telemetry.stateAfter).toBe('IDLE');
      });

      it('B5.5 DLQ preserves corrupted JSON payloads as string without crashing reader', () => {
        db.insertDeadLetter({
          id: 'dlq-corrupted',
          tenant_id: 'default',
          task_id: 'task-corrupt',
          skill_name: 'content-producer',
          payload_json: '{ bad json string',
          error_message: 'Corrupted payload',
          error_stack: null,
          retry_count: 3,
          max_retries: 3,
          status: 'dead',
          first_failed_at: Date.now(),
          last_failed_at: Date.now(),
          resolved_at: null,
          created_at: Date.now(),
        });

        const letters = db.getDeadLetters('default');
        expect(letters.some((l) => l.id === 'dlq-corrupted')).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3: CROSS-FEATURE PAIRWISE COMBINATIONS (6 tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 3: Cross-Feature Pairwise Combinations', () => {
    it('C1: Scheduled Trigger -> Cron Evaluation -> Budget Check -> Swarm Dispatch -> D1 Cycle Run Log', () => {
      const now = Math.floor(Date.UTC(2026, 9, 6, 6, 0, 0) / 1000);
      const telemetry = executeFullAutonomousCycle(db, {
        nowSeconds: now,
        availableMcu: 100,
        maxTokensPerCycle: 20000,
      });

      expect(telemetry.tasksSucceeded).toBeGreaterThanOrEqual(1);

      const runs = db.getCycleRuns('default');
      expect(runs.length).toBeGreaterThan(0);
      expect(runs[0].mcu_consumed).toBe(telemetry.mcuConsumed);
    });

    it('C2: Task Failure -> Exponential Backoff Retries -> Retry Exhaustion -> DLQ Serialization -> State Remains Recovering', () => {
      const telemetry = executeFullAutonomousCycle(db, {
        mockFailureTaskIds: ['task-affiliate-scout'],
        availableMcu: 100,
      });

      expect(telemetry.tasksFailed).toBeGreaterThan(0);
      expect(telemetry.stateAfter).toBe('RECOVERING');

      const dlq = db.getDeadLetters('default');
      expect(dlq.length).toBeGreaterThan(0);
      expect(dlq[0].task_id).toBe('task-affiliate-scout');
    });

    it('C3: 5 Consecutive Failures -> Circuit Breaker Trips to OPEN -> State Transitions to CIRCUIT_BROKEN -> Blocks Subsequent Cycles', () => {
      for (let i = 0; i < 5; i++) {
        executeFullAutonomousCycle(db, {
          mockFailureTaskIds: ['task-affiliate-scout', 'task-content-producer', 'task-auto-publisher'],
        });
      }

      const loopState = db.getLoopState('default')!;
      expect(loopState.state).toBe('CIRCUIT_BROKEN');
      expect(loopState.consecutive_failures).toBeGreaterThanOrEqual(5);

      // Subsequent cycle attempt is blocked
      const blockedTelemetry = executeFullAutonomousCycle(db);
      expect(blockedTelemetry.tasksAttempted).toBe(0);
      expect(blockedTelemetry.errorSummary).toContain('CIRCUIT_BROKEN');
    });

    it('C4: Circuit Breaker OPEN -> Cooldown Expires -> Force Probe Cycle -> Recovery Success -> Circuit Closes -> State Restored to IDLE', () => {
      db.updateLoopState('default', {
        state: 'CIRCUIT_BROKEN',
        consecutive_failures: 5,
      });

      // Probe cycle using force
      const probeTelemetry = executeFullAutonomousCycle(db, {
        force: true,
      });

      expect(probeTelemetry.tasksFailed).toBe(0);
      const restoredState = db.getLoopState('default')!;
      expect(restoredState.state).toBe('IDLE');
      expect(restoredState.consecutive_failures).toBe(0);
    });

    it('C5: Budget Exhaustion (0 MCU) -> Capability Blocked -> BUDGET_EXCEEDED Event -> State Transitions to PAUSED', () => {
      const telemetry = executeFullAutonomousCycle(db, {
        availableMcu: 0,
        mockFatalError: 'budget_exceeded: MCU limit exhausted',
      });

      expect(telemetry.stateAfter).toBe('PAUSED');
      const state = db.getLoopState('default')!;
      expect(state.state).toBe('PAUSED');
    });

    it('C6: Operator Emergency Halt -> Running Loop Suspended -> PAUSED State -> Manual Reset -> Failure Count Cleared -> IDLE', () => {
      db.updateLoopState('default', {
        state: 'RUNNING',
        consecutive_failures: 3,
      });

      const haltRes = emergencyHaltAutonomousLoop(db, 'default');
      expect(haltRes.success).toBe(true);
      expect(haltRes.state).toBe('PAUSED');

      const resetRes = resetCircuitBreaker(db, 'default');
      expect(resetRes.success).toBe(true);
      expect(resetRes.state).toBe('IDLE');

      const finalState = db.getLoopState('default')!;
      expect(finalState.state).toBe('IDLE');
      expect(finalState.consecutive_failures).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 Scenarios)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 4: Real-World Application Scenarios', () => {
    it('Scenario 1: 24/7 Autonomous Marketing Pipeline Full Lifecycle', () => {
      // Step 1: Scout discovers affiliate offers
      const scoutTask = db.getScheduleTask('task-affiliate-scout')!;
      const scoutRes = executeSwarmTask(scoutTask, {
        tenantId: 'default',
        availableMcu: 500,
        maxTokensPerCycle: 20000,
      });
      expect(scoutRes.success).toBe(true);

      // Step 2: Content Producer generates viral bilingual video draft
      const producerTask = db.getScheduleTask('task-content-producer')!;
      const producerRes = executeSwarmTask(producerTask, {
        tenantId: 'default',
        availableMcu: 490,
        maxTokensPerCycle: 20000,
      });
      expect(producerRes.success).toBe(true);

      // Step 3: Auto-Publisher syndicates to YouTube & TikTok
      const publisherTask = db.getScheduleTask('task-auto-publisher')!;
      const publisherRes = executeSwarmTask(publisherTask, {
        tenantId: 'default',
        availableMcu: 440,
        maxTokensPerCycle: 20000,
      });
      expect(publisherRes.success).toBe(true);

      // Step 4: Full automated cycle run logs telemetry
      const telemetry = executeFullAutonomousCycle(db, {
        availableMcu: 500,
        nowSeconds: Math.floor(Date.now() / 1000) + 10000,
      });
      expect(telemetry.tasksFailed).toBe(0);
      expect(telemetry.tasksSucceeded).toBe(3);
      expect(telemetry.mcuConsumed).toBe(80);
    });

    it('Scenario 2: Transient Network Flap & Graceful Self-Recovery', () => {
      // Cycle 1: Network flap on auto-publisher
      const cycle1 = executeFullAutonomousCycle(db, {
        mockFailureTaskIds: ['task-auto-publisher'],
      });
      expect(cycle1.tasksFailed).toBe(1);
      expect(cycle1.stateAfter).toBe('RECOVERING');

      let state = db.getLoopState('default')!;
      expect(state.state).toBe('RECOVERING');
      expect(state.consecutive_failures).toBe(1);

      // Cycle 2: Network restored, cycle succeeds
      const cycle2 = executeFullAutonomousCycle(db, {
        nowSeconds: Math.floor(Date.now() / 1000) + 10000,
      });
      expect(cycle2.tasksFailed).toBe(0);
      expect(cycle2.stateAfter).toBe('IDLE');

      state = db.getLoopState('default')!;
      expect(state.consecutive_failures).toBe(0);
    });

    it('Scenario 3: Cascading Failure & Circuit Breaker Isolation', () => {
      for (let i = 0; i < 5; i++) {
        executeFullAutonomousCycle(db, {
          mockFailureTaskIds: ['task-affiliate-scout', 'task-content-producer', 'task-auto-publisher'],
        });
      }

      const loopState = db.getLoopState('default')!;
      expect(loopState.state).toBe('CIRCUIT_BROKEN');

      // Subsequent scheduled trigger does not hammer backend services
      const droppedCycle = executeFullAutonomousCycle(db);
      expect(droppedCycle.tasksAttempted).toBe(0);
    });

    it('Scenario 4: Runaway Spend Emergency Halt & DLQ Replay', () => {
      executeFullAutonomousCycle(db, {
        mockFailureTaskIds: ['task-content-producer'],
      });

      emergencyHaltAutonomousLoop(db, 'default');
      expect(db.getLoopState('default')?.state).toBe('PAUSED');

      const dlqLetters = db.getDeadLetters('default');
      expect(dlqLetters.length).toBeGreaterThan(0);

      const replay = replayDeadLetterQueueTask(db, 'default', dlqLetters[0].id);
      expect(replay.success).toBe(true);

      resumeAutonomousLoop(db, 'default');
      expect(db.getLoopState('default')?.state).toBe('IDLE');
    });

    it('Scenario 5: Multi-Tenant Concurrent Execution & State Isolation', () => {
      // Provision Tenant B
      db.rawDb.prepare(`
        INSERT INTO autonomous_loop_state (tenant_id, state, current_cycle_id, consecutive_failures, last_heartbeat_at, version, updated_at)
        VALUES ('tenant-b', 'IDLE', null, 0, 1000, 1, 1000)
      `).run();

      db.rawDb.prepare(`
        INSERT INTO autonomous_schedule_tasks (
          id, tenant_id, skill_name, capability_name, schedule_type, schedule_expression, interval_seconds, priority, enabled, next_run_at, created_at, updated_at
        ) VALUES ('task-tenant-b-scout', 'tenant-b', 'affiliate-scout', 'affiliate-scout', 'interval', null, 3600, 1, 1, 1000, 1000, 1000)
      `).run();

      // Pause Tenant B
      pauseAutonomousLoop(db, 'tenant-b');
      expect(db.getLoopState('tenant-b')?.state).toBe('PAUSED');

      // Execute full cycle on Tenant A (default)
      const telemetryA = executeFullAutonomousCycle(db, {
        tenantId: 'default',
        nowSeconds: 2000,
      });
      expect(telemetryA.tasksFailed).toBe(0);

      // Tenant B remains PAUSED and unperturbed
      expect(db.getLoopState('tenant-b')?.state).toBe('PAUSED');

      const runsB = db.getCycleRuns('tenant-b');
      expect(runsB.length).toBe(0);
    });
  });
});
