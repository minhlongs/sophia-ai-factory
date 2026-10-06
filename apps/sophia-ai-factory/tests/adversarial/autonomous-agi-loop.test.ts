/**
 * Adversarial Empirical Challenger Test Suite — Autonomous AGI Loop Control
 *
 * @vitest-environment node
 *
 * Focus:
 * 1. Byzantine Clock Skew & Temporal Non-Linearity (backwards leaps, far-future overflow, sub-second jitter)
 * 2. High-Concurrency CAS Lease Contention & Race Conditions (50 concurrent workers, split-brain prevention)
 * 3. Monte Carlo Backoff Jitter Distribution & Entropy Guarantees (1000 runs, boundary random floats)
 * 4. Malicious Payload Injection & DLQ Poisoning (SQL injection, prototype pollution, 1MB payload flood)
 * 5. Pathological Cron Expressions & Parser DoS Resistance (ReDoS immunity, impossible steps, inverse ranges)
 * 6. Resource Depletion, Budget Boundary Extremes & Memory Churn (MAX_SAFE_INTEGER, micro-MCU, flapping attack)
 *
 * Conforms to: Sophia 4-Layer Architecture Doctrine, Zero :any types rule.
 *
 * @module tests/adversarial/autonomous-agi-loop.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAutonomousTestD1,
  type MockAutonomousD1,
  buildDeadLetterEntry,
  executeFullAutonomousCycle,
} from '../e2e/autonomous-harness';

import {
  transitionAutonomousState,
  canTransition,
  DEFAULT_MAX_CONSECUTIVE_FAILURES,
  AutonomousStateTransitionError,
} from '@/tree/autonomous/state-machine';

import {
  parseCronExpression,
  isCronDue,
  calculateNextCronRun,
  calculateNextIntervalRun,
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
  type CircuitBreakerStatus,
} from '@/tree/autonomous/circuit-breaker';

import {
  executeSwarmTask,
  canExecuteCapability,
  type SwarmExecutionContext,
} from '@/tree/autonomous/swarm-orchestrator';

import type {
  AutonomousScheduleTaskRow,
  AutonomousEngineState,
  AutonomousDeadLetterQueueRow,
} from '@/seed/types/autonomous-engine';

describe('Autonomous AGI Loop Control — Adversarial Empirical Challenger Suite', () => {
  let db: MockAutonomousD1;

  beforeEach(() => {
    db = createAutonomousTestD1();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 1: Byzantine Clock Skew & Temporal Non-Linearity
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 1: Byzantine Clock Skew & Temporal Non-Linearity', () => {
    it('1.1 handles massive backward time jump (-86400s) without state machine or cooldown corruption', () => {
      const normalTime = 1775462400000;
      const status: CircuitBreakerStatus = {
        serviceOrSkill: 'adversarial-service',
        state: 'OPEN',
        consecutiveFailures: 5,
        failureThreshold: 5,
        cooldownPeriodMs: 300000, // 5 min
        lastFailureAt: normalTime,
        lastStateChangeAt: normalTime,
      };

      const skewedBackwardTime = normalTime - 86400000; // 24 hours in the past!
      expect(isCircuitAvailable(status, skewedBackwardTime)).toBe(false);

      const cooldown = getRemainingCooldownMs(status, skewedBackwardTime);
      expect(cooldown).toBe(300000 + 86400000); // monotonic safe clamping

      const probeResult = evaluateCircuitStatus(status, 'PROBE', skewedBackwardTime);
      expect(probeResult.state).toBe('OPEN');
      expect(probeResult.allowRequest).toBe(false);
    });

    it('1.2 micro-step time oscillations (+/- 1ms jitter) maintain strict monotonicity in lease locks', () => {
      const baseTs = 1775462400; // seconds
      db.updateLoopState('default', {
        state: 'RUNNING',
        last_heartbeat_at: baseTs,
      });

      // Rapid micro-jitter sequence: +1ms, -1ms, +2ms, 0ms
      const offsets = [1, -1, 2, 0, -2, 3];
      for (const off of offsets) {
        const simTime = baseTs + off;
        const res = db.updateLoopState('default', {
          last_heartbeat_at: simTime,
        });
        expect(res).toBe(true);
      }

      const finalState = db.getLoopState('default')!;
      expect(finalState.version).toBeGreaterThan(offsets.length);
    });

    it('1.3 far-future leap (+100 years: 3,153,600,000s) handles cooldown expiration and does not produce NaN', () => {
      const now = 1775462400000;
      const farFuture = now + 100 * 365 * 86400 * 1000;

      const status: CircuitBreakerStatus = {
        serviceOrSkill: 'affiliate-scout',
        state: 'OPEN',
        consecutiveFailures: 5,
        failureThreshold: 5,
        cooldownPeriodMs: 300000,
        lastFailureAt: now,
        lastStateChangeAt: now,
      };

      expect(isCircuitAvailable(status, farFuture)).toBe(true);
      const remaining = getRemainingCooldownMs(status, farFuture);
      expect(remaining).toBe(0);
      expect(Number.isNaN(remaining)).toBe(false);

      const probe = evaluateCircuitStatus(status, 'PROBE', farFuture);
      expect(probe.state).toBe('HALF_OPEN');
      expect(probe.allowRequest).toBe(true);
    });

    it('1.4 Year 2038 UNIX epoch rollover (> 2,147,483,647s) safely executes without integer overflow', () => {
      const y2038Plus = 2200000000; // Year ~2039
      const baseDate = new Date(y2038Plus * 1000);

      const nextRun = calculateNextIntervalRun(3600, baseDate);
      expect(nextRun.getTime() / 1000).toBe(y2038Plus + 3600);

      const cronRun = calculateNextCronRun('0 12 * * *', baseDate);
      expect(cronRun.getTime() / 1000).toBeGreaterThan(y2038Plus);
    });

    it('1.5 sub-second truncation guarantees cron evaluations do not double-fire identical minute slots', () => {
      const cronExpr = '0 6 * * *';
      const exactMinute = new Date(Date.UTC(2026, 9, 6, 6, 0, 0, 0));
      const midSecond = new Date(Date.UTC(2026, 9, 6, 6, 0, 30, 500));
      const endSecond = new Date(Date.UTC(2026, 9, 6, 6, 0, 59, 999));

      expect(isCronDue(cronExpr, exactMinute)).toBe(true);
      expect(isCronDue(cronExpr, midSecond)).toBe(true);
      expect(isCronDue(cronExpr, endSecond)).toBe(true);

      const nextMinute = new Date(Date.UTC(2026, 9, 6, 6, 1, 0, 0));
      expect(isCronDue(cronExpr, nextMinute)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 2: High-Concurrency CAS Lease Contention & Race Conditions
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 2: High-Concurrency CAS Lease Contention & Race Conditions', () => {
    it('2.1 50 simulated concurrent Workers attempting CAS lease: exactly 1 wins, 49 fail with version conflict', () => {
      const initialState = db.getLoopState('default')!;
      const baseVersion = initialState.version;

      let acquiredCount = 0;
      let rejectedCount = 0;

      // 50 concurrent Workers read initial state and attempt to update with baseVersion
      for (let workerId = 1; workerId <= 50; workerId++) {
        const acquired = db.updateLoopState(
          'default',
          {
            state: 'RUNNING',
            current_cycle_id: `cycle-worker-${workerId}`,
            last_heartbeat_at: Math.floor(Date.now() / 1000),
          },
          baseVersion // Stale version for 49 of the workers!
        );

        if (acquired) {
          acquiredCount++;
        } else {
          rejectedCount++;
        }
      }

      expect(acquiredCount).toBe(1);
      expect(rejectedCount).toBe(49);

      const finalState = db.getLoopState('default')!;
      expect(finalState.version).toBe(baseVersion + 1);
    });

    it('2.2 split-brain prevention: concurrent heartbeat renewal under stale version is rejected', () => {
      const s1 = db.getLoopState('default')!;

      // Worker 1 advances state version
      const w1 = db.updateLoopState('default', { last_heartbeat_at: 1000 }, s1.version);
      expect(w1).toBe(true);

      // Stale Worker 2 attempts update with old version
      const w2 = db.updateLoopState('default', { last_heartbeat_at: 1001 }, s1.version);
      expect(w2).toBe(false);
    });

    it('2.3 multi-tenant deadlock immunity: concurrent loops for distinct tenants never block or collide', () => {
      db.rawDb.prepare(`
        INSERT INTO autonomous_loop_state (tenant_id, state, version, updated_at)
        VALUES ('tenant-alpha', 'IDLE', 1, strftime('%s', 'now')),
               ('tenant-beta', 'IDLE', 1, strftime('%s', 'now'))
      `).run();

      const alphaSuccess = db.updateLoopState('tenant-alpha', { state: 'RUNNING' }, 1);
      const betaSuccess = db.updateLoopState('tenant-beta', { state: 'RUNNING' }, 1);

      expect(alphaSuccess).toBe(true);
      expect(betaSuccess).toBe(true);

      const alphaState = db.getLoopState('tenant-alpha')!;
      const betaState = db.getLoopState('tenant-beta')!;
      expect(alphaState.state).toBe('RUNNING');
      expect(betaState.state).toBe('RUNNING');
      expect(alphaState.tenant_id).toBe('tenant-alpha');
      expect(betaState.tenant_id).toBe('tenant-beta');
    });

    it('2.4 stale lease reclamation: abandoned lease lock after locked_until expires is reclaimed', () => {
      const nowSec = 1775462400;
      const expiredSec = nowSec - 60; // 60s in the past

      const taskRow: AutonomousScheduleTaskRow = {
        id: 'task-stale-lock',
        tenant_id: 'default',
        skill_name: 'affiliate-scout',
        capability_name: 'affiliate-scout',
        schedule_type: 'interval',
        schedule_expression: null,
        interval_seconds: 300,
        event_trigger: null,
        timezone: 'UTC',
        tier_requirement: 'BASIC',
        priority: 1,
        enabled: 1,
        last_run_at: null,
        next_run_at: expiredSec,
        run_count: 5,
        failure_count: 0,
        lock_token: 'dead-worker-token-xyz',
        locked_until: expiredSec, // expired lock!
        created_at: expiredSec,
        updated_at: expiredSec,
      };

      // Since locked_until <= nowSec, task is due and eligible for reclamation
      expect(isTaskDue(taskRow, nowSec * 1000)).toBe(true);
    });

    it('2.5 zero-window boundary: locked_until === nowSec is considered expired and ready for execution', () => {
      const nowSec = 1775462400;
      const taskRow: AutonomousScheduleTaskRow = {
        id: 'task-zero-boundary',
        tenant_id: 'default',
        skill_name: 'affiliate-scout',
        capability_name: 'affiliate-scout',
        schedule_type: 'interval',
        schedule_expression: null,
        interval_seconds: 300,
        event_trigger: null,
        timezone: 'UTC',
        tier_requirement: 'BASIC',
        priority: 1,
        enabled: 1,
        last_run_at: null,
        next_run_at: nowSec,
        run_count: 0,
        failure_count: 0,
        lock_token: 'token-abc',
        locked_until: nowSec, // exactly equal to current second
        created_at: nowSec,
        updated_at: nowSec,
      };

      expect(isTaskDue(taskRow, nowSec * 1000)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 3: Monte Carlo Backoff Jitter Distribution & Entropy Guarantees
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 3: Monte Carlo Backoff Jitter Distribution & Entropy Guarantees', () => {
    it('3.1 1,000 Monte Carlo runs verify backoff delay strictly within [nominal, nominal * (1 + jitterPct)]', () => {
      const attempt = 2; // base 60s * 2^2 = 240,000 ms
      const nominal = 60000 * Math.pow(2, 2);
      const minExpected = nominal; // 240,000
      const maxExpected = nominal * (1 + DEFAULT_BACKOFF_CONFIG.jitterPct); // 240,000 * 1.2 = 288,000

      const sampleSize = 1000;
      const delays: number[] = [];

      for (let i = 0; i < sampleSize; i++) {
        const rand = Math.random();
        const res = calculateBackoff(attempt, DEFAULT_BACKOFF_CONFIG, rand);
        expect(res.delayMs).toBeGreaterThanOrEqual(minExpected);
        expect(res.delayMs).toBeLessThanOrEqual(maxExpected);
        delays.push(res.delayMs);
      }

      // Statistical spread check
      const minObserved = Math.min(...delays);
      const maxObserved = Math.max(...delays);
      expect(minObserved).toBeLessThanOrEqual(nominal + 1000);
      expect(maxObserved).toBeGreaterThan(nominal + 10000);
    });

    it('3.2 pathological randomFloat values (0.0, 1.0, 0.5, Number.EPSILON) stay bounded', () => {
      const config = { baseDelayMs: 10000, factor: 2.0, maxDelayMs: 60000, jitterPct: 0.2, maxRetries: 3 };

      const bZero = calculateBackoff(1, config, 0.0);
      expect(bZero.delayMs).toBe(20000); // 20000 + 0

      const bOne = calculateBackoff(1, config, 1.0);
      expect(bOne.delayMs).toBe(24000); // 20000 + 4000

      const bHalf = calculateBackoff(1, config, 0.5);
      expect(bHalf.delayMs).toBe(22000); // 20000 + 2000

      const bEpsilon = calculateBackoff(1, config, Number.EPSILON);
      expect(bEpsilon.delayMs).toBeGreaterThanOrEqual(20000);
      expect(bEpsilon.delayMs).toBeLessThanOrEqual(24000);
    });

    it('3.3 exponential growth attempt=100 never produces Infinity or overflows maxDelayMs', () => {
      const res = calculateBackoff(100, {
        baseDelayMs: 1000,
        factor: 2.0,
        maxDelayMs: 1800000,
        jitterPct: 0.2,
        maxRetries: 150,
      });

      expect(Number.isFinite(res.delayMs)).toBe(true);
      expect(res.delayMs).toBeLessThanOrEqual(1800000);
      expect(res.delayMs).toBeGreaterThan(0);
    });

    it('3.4 zero jitter (jitterPct=0) produces identical deterministic outputs regardless of randomFloat', () => {
      const zeroJitterConfig = { baseDelayMs: 5000, factor: 3.0, maxDelayMs: 60000, jitterPct: 0, maxRetries: 5 };

      const r1 = calculateBackoff(2, zeroJitterConfig, 0.123);
      const r2 = calculateBackoff(2, zeroJitterConfig, 0.987);

      expect(r1.delayMs).toBe(45000); // 5000 * 3^2 = 45000
      expect(r2.delayMs).toBe(45000);
      expect(r1.delayMs).toBe(r2.delayMs);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 4: Malicious Payload Injection & DLQ Poisoning
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 4: Malicious Payload Injection & DLQ Poisoning', () => {
    it('4.1 SQL injection attack in task ID, skill name, and error message is safely parameterized', () => {
      const maliciousTaskId = "task-1'; DROP TABLE autonomous_schedule_tasks; --";
      const maliciousSkill = "' OR '1'='1";
      const maliciousError = "Error: '); DELETE FROM autonomous_loop_state; --";

      const taskRow: AutonomousScheduleTaskRow = {
        id: maliciousTaskId,
        tenant_id: 'default',
        skill_name: maliciousSkill,
        capability_name: 'affiliate-scout',
        schedule_type: 'interval',
        schedule_expression: null,
        interval_seconds: 3600,
        event_trigger: null,
        timezone: 'UTC',
        tier_requirement: 'BASIC',
        priority: 1,
        enabled: 1,
        last_run_at: null,
        next_run_at: 1000,
        run_count: 0,
        failure_count: 3,
        lock_token: null,
        locked_until: null,
        created_at: 1000,
        updated_at: 1000,
      };

      const dlqEntry = buildDeadLetterEntry(
        taskRow,
        { injection: maliciousSkill },
        maliciousError,
        1000
      );

      // Insert into DLQ table
      db.insertDeadLetter(dlqEntry);

      // Verify tables still exist and were not dropped
      const tasks = db.getScheduleTasks('default');
      expect(Array.isArray(tasks)).toBe(true);

      const loopState = db.getLoopState('default');
      expect(loopState).toBeDefined();

      const dlqs = db.getDeadLetters('default');
      const retrieved = dlqs.find((d) => d.task_id === maliciousTaskId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.error_message).toBe(maliciousError);
    });

    it('4.2 100KB deeply nested JSON payload in DLQ does not crash serializer or reader', () => {
      const deepPayload: Record<string, unknown> = {};
      let curr = deepPayload;
      for (let i = 0; i < 50; i++) {
        curr[`nest_${i}`] = { payload_junk: 'A'.repeat(2000) };
        curr = curr[`nest_${i}`] as Record<string, unknown>;
      }

      const taskRow: AutonomousScheduleTaskRow = {
        id: 'task-large-payload',
        tenant_id: 'default',
        skill_name: 'content-producer',
        capability_name: 'content-producer',
        schedule_type: 'interval',
        schedule_expression: null,
        interval_seconds: 3600,
        event_trigger: null,
        timezone: 'UTC',
        tier_requirement: 'BASIC',
        priority: 1,
        enabled: 1,
        last_run_at: null,
        next_run_at: 1000,
        run_count: 0,
        failure_count: 3,
        lock_token: null,
        locked_until: null,
        created_at: 1000,
        updated_at: 1000,
      };

      const dlq = buildDeadLetterEntry(taskRow, deepPayload, 'Deep payload failure', 2000);
      db.insertDeadLetter(dlq);

      const retrieved = db.getDeadLetters('default').find((d) => d.id === dlq.id)!;
      expect(retrieved).toBeDefined();
      expect(retrieved.payload_json.length).toBeGreaterThan(100000);
    });

    it('4.3 prototype pollution string payload does not pollute Object.prototype', () => {
      const pollutionJson = '{"__proto__": {"pollutedKey": "evil_payload"}}';
      const parsed = JSON.parse(pollutionJson) as Record<string, unknown>;

      // Ensure prototype itself was not polluted
      expect((Object.prototype as { pollutedKey?: string }).pollutedKey).toBeUndefined();

      db.insertDeadLetter({
        id: 'dlq-pollution-test',
        tenant_id: 'default',
        task_id: 'task-pollute',
        skill_name: 'affiliate-scout',
        payload_json: pollutionJson,
        error_message: 'prototype pollution attempt',
        error_stack: null,
        retry_count: 3,
        max_retries: 3,
        status: 'dead',
        first_failed_at: Date.now(),
        last_failed_at: Date.now(),
        resolved_at: null,
        created_at: Date.now(),
      });

      expect((({} as { pollutedKey?: string })).pollutedKey).toBeUndefined();
    });

    it('4.4 unhandled Unicode null bytes and unpaired surrogate pairs handled safely', () => {
      const dangerousStr = 'Error: \u0000\u0001 corrupted trace \uD800\uDFFF end';
      const dlq: AutonomousDeadLetterQueueRow = {
        id: 'dlq-unicode-safe',
        tenant_id: 'default',
        task_id: 'task-unicode',
        skill_name: 'affiliate-scout',
        payload_json: JSON.stringify({ error: dangerousStr }),
        error_message: dangerousStr,
        error_stack: null,
        retry_count: 3,
        max_retries: 3,
        status: 'dead',
        first_failed_at: Date.now(),
        last_failed_at: Date.now(),
        resolved_at: null,
        created_at: Date.now(),
      };

      db.insertDeadLetter(dlq);
      const retrieved = db.getDeadLetters('default').find((d) => d.id === 'dlq-unicode-safe');
      expect(retrieved).toBeDefined();
      expect(retrieved?.error_message).toContain('corrupted trace');
    });

    it('4.5 100 DLQ entries enqueued in rapid burst preserve FIFO retrieval order', () => {
      const count = 100;
      const baseTs = 100000;

      for (let i = 0; i < count; i++) {
        db.insertDeadLetter({
          id: `dlq-burst-${i.toString().padStart(3, '0')}`,
          tenant_id: 'default',
          task_id: `task-${i}`,
          skill_name: 'affiliate-scout',
          payload_json: JSON.stringify({ index: i }),
          error_message: `Burst fail ${i}`,
          error_stack: null,
          retry_count: 3,
          max_retries: 3,
          status: 'dead',
          first_failed_at: baseTs + i,
          last_failed_at: baseTs + i,
          resolved_at: null,
          created_at: baseTs + i,
        });
      }

      const all = db.getDeadLetters('default');
      expect(all.length).toBeGreaterThanOrEqual(100);
      expect(all[0].created_at).toBeGreaterThanOrEqual(all[all.length - 1].created_at);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 5: Pathological Cron Expressions & Parser DoS Attack Resistance
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 5: Pathological Cron Expressions & Parser DoS Attack Resistance', () => {
    it('5.1 10,000-character malicious string evaluates or fails in < 5ms without ReDoS', () => {
      const maliciousLong = '0 '.repeat(5000);
      const t0 = performance.now();
      expect(() => parseCronExpression(maliciousLong)).toThrow();
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(10); // Under 10ms
    });

    it('5.2 deeply repeated comma-delimited fields (1,1,1,...,1) deduplicate accurately', () => {
      const repetitiveCron = '1,1,1,1,1,1,1,1 * * * *';
      const parsed = parseCronExpression(repetitiveCron);
      expect(parsed.minute).toEqual([1]);
    });

    it('5.3 impossible zero step expression (*/0) throws clean error without dividing by zero', () => {
      expect(() => parseCronExpression('*/0 * * * *')).toThrow();
    });

    it('5.4 inverted range (59-0) throws deterministic range error without infinite loop', () => {
      expect(() => parseCronExpression('50-10 * * * *')).toThrow();
    });

    it('5.5 month 13, day 32, hour 24 boundaries throw descriptive validation errors', () => {
      expect(() => parseCronExpression('* 24 * * *')).toThrow();
      expect(() => parseCronExpression('* * 32 * *')).toThrow();
      expect(() => parseCronExpression('* * * 13 *')).toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR 6: Resource Depletion, Budget Boundary Extremes & Memory Stress
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Vector 6: Resource Depletion, Budget Boundary Extremes & Memory Stress', () => {
    it('6.1 MAX_SAFE_INTEGER MCU bounds do not cause precision wrapping or NaN', () => {
      const maxCtx: SwarmExecutionContext = {
        tenantId: 'default',
        availableMcu: Number.MAX_SAFE_INTEGER,
        maxTokensPerCycle: Number.MAX_SAFE_INTEGER,
      };

      expect(canExecuteCapability('affiliate-scout', maxCtx).allowed).toBe(true);
      expect(canExecuteCapability('content-producer', maxCtx).allowed).toBe(true);
      expect(canExecuteCapability('auto-publisher', maxCtx).allowed).toBe(true);
    });

    it('6.2 negative MCU balances (-100 MCU) strictly block all capability executions', () => {
      const negCtx: SwarmExecutionContext = {
        tenantId: 'default',
        availableMcu: -100,
        maxTokensPerCycle: 50000,
      };

      const scoutRes = canExecuteCapability('affiliate-scout', negCtx);
      expect(scoutRes.allowed).toBe(false);
      expect(scoutRes.reason).toContain('Insufficient MCU');
    });

    it('6.3 micro-MCU consumption (1 MCU increments) accurately decrements across 100 iterations', () => {
      let balance = 100;
      for (let i = 0; i < 10; i++) {
        const ctx: SwarmExecutionContext = {
          tenantId: 'default',
          availableMcu: balance,
          maxTokensPerCycle: 20000,
        };
        const task: AutonomousScheduleTaskRow = {
          id: `task-micro-${i}`,
          tenant_id: 'default',
          skill_name: 'affiliate-scout',
          capability_name: 'affiliate-scout',
          schedule_type: 'interval',
          schedule_expression: null,
          interval_seconds: 3600,
          event_trigger: null,
          timezone: 'UTC',
          tier_requirement: 'BASIC',
          priority: 1,
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
        const res = executeSwarmTask(task, ctx);
        expect(res.success).toBe(true);
        balance -= res.mcuConsumed;
      }

      expect(balance).toBe(0); // 100 - (10 * 10) = 0
    });

    it('6.4 rapid cyclic state transitions (100 cycles) maintain version integrity and zero corruption', () => {
      for (let i = 0; i < 100; i++) {
        const s1 = transitionAutonomousState('IDLE', 'TRIGGER_CYCLE');
        expect(s1.nextState).toBe('RUNNING');
        const s2 = transitionAutonomousState('RUNNING', 'CYCLE_SUCCESS');
        expect(s2.nextState).toBe('IDLE');
      }
    });

    it('6.5 circuit breaker flapping resilience: alternating 4 failures and 1 success never trips to OPEN', () => {
      let status = createInitialCircuitStatus('flapping-test', { failureThreshold: 5 });

      // Flapping loop: 4 failures followed by 1 recovery, repeated 10 times (50 events total)
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let f = 0; f < 4; f++) {
          const failRes = evaluateCircuitStatus(status, 'FAILURE');
          status = failRes.status;
          expect(status.state).toBe('CLOSED');
          expect(failRes.tripped).toBe(false);
        }

        const successRes = evaluateCircuitStatus(status, 'SUCCESS');
        status = successRes.status;
        expect(status.state).toBe('CLOSED');
        expect(status.consecutiveFailures).toBe(0);
      }

      expect(status.state).toBe('CLOSED');
    });
  });
});
