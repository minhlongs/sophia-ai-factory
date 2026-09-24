/**
 * Milestone 4 Adversarial Stress Testing & Empirical Challenge Suite
 *
 * Exhaustively stress-tests:
 * 1. Two-Lane Priority Arbitration:
 *    - High-volume standard jobs vs urgent enterprise priority jobs (queue jumping)
 *    - Strict priority score ordering (Master 200 > Enterprise 100 > Pro 25 > Basic 10)
 *    - Lane preference steering (worker explicitly targeting standard vs priority lane)
 *    - Tenant concurrency throttling: tenant exceeding active limit (15 for enterprise, 5 for starter/basic)
 *      is blocked from leasing additional jobs until active jobs complete.
 *    - Multi-tenant fairness bypass: throttled tenants do not starve non-throttled tenants.
 *
 * 2. Concurrent Leasing & Race Conditions:
 *    - 10 simulated concurrent worker leases on a single pending job:
 *      atomic CAS guarantees exactly 1 lease succeeds and 9 fail gracefully with NO_JOBS.
 *    - 20 concurrent worker leases across a small pool of 5 pending jobs:
 *      atomic CAS guarantees exactly 5 leases succeed with zero duplicate job assignments.
 *    - Expired lease recovery: simulated crashed worker with expired lease (leased_until < now)
 *      is safely recovered and re-leased to a healthy worker.
 *    - Non-expired active leases are preserved and not prematurely recovered.
 *
 * 3. GPU Mesh Circuit Breaker & Failover:
 *    - Provider failing 3 times trips circuit breaker to OPEN; subsequent requests immediately skip it.
 *    - Cooldown timer transitions OPEN to HALF_OPEN; probe request succeeds; reaching success threshold resets to CLOSED.
 *    - Probe failure during HALF_OPEN immediately trips circuit back to OPEN with renewed cooldown.
 *    - Complete mesh collapse: all 4 providers failing throws AllProvidersFailedError cleanly with detailed provider attempt records.
 *
 * 4. DLQ & Alert Dispatching:
 *    - Exponential backoff calculation and cap bounds: delayMs = Math.min(base * 2^retries, max).
 *    - Jitter bounds: random 10% jitter satisfies [capped, capped * 1.10].
 *    - Incremental retry count tracking and terminal state routing to DLQ when retry_count >= max_retries with detailed dlq_reason.
 *    - Explicit routeJobToDlq preserves custom error reasons and clears worker lease bindings.
 *    - Alert dispatching handles missing credentials without crashing (logger fallback with loggedFallback=true).
 *    - Alert dispatching handles downstream API network errors / non-200 responses gracefully without unhandled rejections.
 *
 * Layer: tree/queue/__tests__
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import type {
  VideoRenderJob,
  VideoRenderRow,
  QueueLane,
  JobStatus,
  GpuProvider,
  DlqAlertPayload,
} from '@/seed/types/video-render-queue';
import {
  DEFAULT_SCHEDULER_CONFIG,
  ALL_GPU_PROVIDERS,
} from '@/seed/types/video-render-queue';
import {
  enqueueJob,
  leaseNextJob,
  recoverExpiredLeases,
  getTenantActiveRenderCount,
  getTenantConcurrencyLimit,
  markJobRendering,
  completeJob,
  failJob,
  cancelJob,
  getJobById,
  getQueueMetrics,
} from '../fair-share-gpu-scheduler';
import {
  CircuitBreakerRegistry,
  executeWithMeshFailover,
  AllProvidersFailedError,
  DEFAULT_PROVIDER_CHAIN,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from '../gpu-mesh-failover';
import {
  calculateExponentialBackoff,
  shouldRouteToDlq,
  routeJobToDlq,
  dispatchDlqAlert,
  formatTelegramDlqMessage,
  formatIncidentWebhookPayload,
} from '../dlq-alert-dispatcher';

/**
 * Pure in-memory SQLite implementation of Cloudflare D1
 */
function createTestD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS video_render_jobs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      subaccount_id TEXT,
      lane TEXT NOT NULL DEFAULT 'standard' CHECK (lane IN ('priority', 'standard')),
      priority_score INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'leased', 'rendering', 'completed', 'failed', 'dlq')),
      tier TEXT NOT NULL,
      payload TEXT NOT NULL,
      result_url TEXT,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      leased_by TEXT,
      leased_until INTEGER,
      provider TEXT CHECK (provider IN ('fal', 'runpod', 'replicate', 'mekong')),
      dlq_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_vrj_lane_status_priority ON video_render_jobs(lane, status, priority_score DESC, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_vrj_org_status ON video_render_jobs(org_id, status);
    CREATE INDEX IF NOT EXISTS idx_vrj_leased_until ON video_render_jobs(leased_until);
    CREATE INDEX IF NOT EXISTS idx_vrj_subaccount ON video_render_jobs(subaccount_id);
  `);

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...vals: unknown[]) {
          bound = vals;
          return this;
        },
        async run(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const res = stmt.run(...params);
          return {
            success: true,
            meta: { changes: res.changes, duration: 1 },
            changes: res.changes,
            lastInsertRowid: res.lastInsertRowid,
          };
        },
        async all(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...params);
          return {
            results,
            meta: { changes: 0, duration: 1 },
          };
        },
        async first(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...params);
          return (row as any) ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

describe('Milestone 4 Adversarial Stress Testing & Empirical Challenge Suite', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestD1();
  });

  // =========================================================================
  // 1. Two-Lane Priority Arbitration & Queue Jumping
  // =========================================================================
  describe('1. Two-Lane Priority Arbitration & Queue Jumping', () => {
    it('empirical challenge: urgent enterprise and master priority jobs jump ahead of 50 queued standard jobs', async () => {
      const now = Math.floor(Date.now() / 1000);

      // Enqueue 50 standard jobs from basic tenants
      for (let i = 1; i <= 50; i++) {
        await enqueueJob(db, {
          id: `standard_basic_${i}`,
          orgId: `org_basic_${i % 10}`,
          tier: 'basic',
          lane: 'standard',
          priorityScore: 10,
          payload: { prompt: `Standard Basic Job ${i}` },
        });
      }

      // Enqueue 5 pro jobs (score 25, lane standard)
      for (let i = 1; i <= 5; i++) {
        await enqueueJob(db, {
          id: `standard_pro_${i}`,
          orgId: `org_pro_${i}`,
          tier: 'pro',
          lane: 'standard',
          priorityScore: 25,
          payload: { prompt: `Pro Job ${i}` },
        });
      }

      // Enqueue 1 urgent Enterprise job (score 100, lane priority)
      await enqueueJob(db, {
        id: 'enterprise_urgent_job',
        orgId: 'org_enterprise_corp',
        tier: 'enterprise',
        lane: 'priority',
        priorityScore: 100,
        payload: { prompt: 'Urgent Enterprise Keynote Render' },
      });

      // Enqueue 1 urgent Master job (score 200, lane priority)
      await enqueueJob(db, {
        id: 'master_urgent_job',
        orgId: 'org_master_media',
        tier: 'master',
        lane: 'priority',
        priorityScore: 200,
        payload: { prompt: 'Master Live Broadcast Stream' },
      });

      // Verify queue metrics before leasing
      const metricsBefore = await getQueueMetrics(db);
      expect(metricsBefore.priority.queued).toBe(2);
      expect(metricsBefore.standard.queued).toBe(55);
      expect(metricsBefore.totalQueued).toBe(57);

      // Lease 1: Must be Master tier priority job (score 200)
      const lease1 = await leaseNextJob(db, 'worker_node_1', 60);
      expect(lease1.leased).toBe(true);
      expect(lease1.job?.id).toBe('master_urgent_job');
      expect(lease1.job?.lane).toBe('priority');
      expect(lease1.job?.priorityScore).toBe(200);

      // Lease 2: Must be Enterprise tier priority job (score 100)
      const lease2 = await leaseNextJob(db, 'worker_node_2', 60);
      expect(lease2.leased).toBe(true);
      expect(lease2.job?.id).toBe('enterprise_urgent_job');
      expect(lease2.job?.lane).toBe('priority');
      expect(lease2.job?.priorityScore).toBe(100);

      // Lease 3: Priority lane is now empty; must fall back to standard lane
      // and pick a PRO job (score 25), NOT a basic job (score 10)
      const lease3 = await leaseNextJob(db, 'worker_node_3', 60);
      expect(lease3.leased).toBe(true);
      expect(lease3.job?.lane).toBe('standard');
      expect(lease3.job?.priorityScore).toBe(25);
      expect(lease3.job?.tier).toBe('pro');

      // Verify metrics after 3 priority-based leases
      const metricsAfter = await getQueueMetrics(db);
      expect(metricsAfter.priority.queued).toBe(0);
      expect(metricsAfter.priority.leased).toBe(2);
      expect(metricsAfter.standard.leased).toBe(1);
      expect(metricsAfter.totalActive).toBe(3);
    });

    it('empirical challenge: tenant exceeding active limit is blocked from leasing until renders complete', async () => {
      const orgEnterprise = 'org_enterprise_mega';
      const enterpriseLimit = getTenantConcurrencyLimit('enterprise', DEFAULT_SCHEDULER_CONFIG);
      expect(enterpriseLimit).toBe(15);

      // Enqueue 20 jobs for this enterprise tenant
      for (let i = 1; i <= 20; i++) {
        await enqueueJob(db, {
          id: `ent_job_${i}`,
          orgId: orgEnterprise,
          tier: 'enterprise',
          lane: 'priority',
          priorityScore: 100,
          payload: { clipIndex: i },
        });
      }

      // Lease up to the exact limit (15 jobs)
      for (let i = 1; i <= enterpriseLimit; i++) {
        const leaseRes = await leaseNextJob(db, `worker_ent_${i}`, 60);
        expect(leaseRes.leased).toBe(true);
        expect(leaseRes.job?.orgId).toBe(orgEnterprise);
      }

      // Check active render count
      const activeCount = await getTenantActiveRenderCount(db, orgEnterprise);
      expect(activeCount).toBe(15);

      // Attempt 16th lease: Must be blocked by tenant concurrency limit
      const blockedLease = await leaseNextJob(db, 'worker_ent_16', 60);
      expect(blockedLease.leased).toBe(false);
      expect(blockedLease.reason).toBe('TENANT_CONCURRENCY_LIMIT');

      // Now complete 1 active job
      const completed = await completeJob(db, 'ent_job_1', 'https://cdn.sophia.agencyos.network/videos/ent_job_1.mp4');
      expect(completed).toBe(true);

      const activeAfterCompletion = await getTenantActiveRenderCount(db, orgEnterprise);
      expect(activeAfterCompletion).toBe(14);

      // Attempt 16th lease again: Must now SUCCEED because active count dropped below limit
      const unblockedLease = await leaseNextJob(db, 'worker_ent_16', 60);
      expect(unblockedLease.leased).toBe(true);
      expect(unblockedLease.job?.id).toBe('ent_job_16');
    });

    it('empirical challenge: starter tier tenant is capped at 5 active renders', async () => {
      const orgStarter = 'org_starter_agency';
      const starterLimit = getTenantConcurrencyLimit('starter', DEFAULT_SCHEDULER_CONFIG);
      expect(starterLimit).toBe(5);

      for (let i = 1; i <= 8; i++) {
        await enqueueJob(db, {
          id: `starter_job_${i}`,
          orgId: orgStarter,
          tier: 'starter',
          lane: 'standard',
          priorityScore: 10,
          payload: { clipIndex: i },
        });
      }

      // Lease 5 jobs
      for (let i = 1; i <= 5; i++) {
        const lease = await leaseNextJob(db, `worker_starter_${i}`, 60);
        expect(lease.leased).toBe(true);
      }

      // 6th lease blocked
      const lease6 = await leaseNextJob(db, 'worker_starter_6', 60);
      expect(lease6.leased).toBe(false);
      expect(lease6.reason).toBe('TENANT_CONCURRENCY_LIMIT');
    });

    it('empirical challenge: multi-tenant fair-share bypass allows other tenants to lease when one tenant is throttled', async () => {
      const orgSaturated = 'org_saturated_starter';
      const orgHealthy = 'org_healthy_starter';

      // Saturated tenant has 6 jobs, leases 5 (reaches limit of 5)
      for (let i = 1; i <= 6; i++) {
        await enqueueJob(db, {
          id: `sat_job_${i}`,
          orgId: orgSaturated,
          tier: 'starter',
          lane: 'standard',
          priorityScore: 10,
          payload: { index: i },
        });
      }
      for (let i = 1; i <= 5; i++) {
        await leaseNextJob(db, `worker_sat_${i}`, 60);
      }

      // Healthy tenant enqueues 1 job
      await enqueueJob(db, {
        id: 'healthy_job_1',
        orgId: orgHealthy,
        tier: 'starter',
        lane: 'standard',
        priorityScore: 10,
        payload: { index: 1 },
      });

      // Next worker attempts lease: sat_job_6 is first in queue but saturated org is throttled
      // Scheduler MUST skip sat_job_6 and lease healthy_job_1 without blocking the cluster
      const bypassLease = await leaseNextJob(db, 'worker_fair_share', 60);
      expect(bypassLease.leased).toBe(true);
      expect(bypassLease.job?.id).toBe('healthy_job_1');
      expect(bypassLease.job?.orgId).toBe(orgHealthy);
    });

    it('empirical challenge: explicit lane preference allows dedicated standard workers', async () => {
      await enqueueJob(db, {
        id: 'prio_job_a',
        orgId: 'org_prio',
        tier: 'enterprise',
        lane: 'priority',
        priorityScore: 100,
        payload: {},
      });
      await enqueueJob(db, {
        id: 'std_job_b',
        orgId: 'org_std',
        tier: 'basic',
        lane: 'standard',
        priorityScore: 10,
        payload: {},
      });

      // Dedicated worker with lanePreference: 'standard'
      const stdLease = await leaseNextJob(db, 'worker_std_only', 60, 'standard');
      expect(stdLease.leased).toBe(true);
      expect(stdLease.job?.id).toBe('std_job_b');
      expect(stdLease.job?.lane).toBe('standard');
    });
  });

  // =========================================================================
  // 2. Concurrent Leasing & Race Conditions (Atomic CAS)
  // =========================================================================
  describe('2. Concurrent Leasing & Race Conditions (Atomic CAS)', () => {
    it('empirical challenge: 10 simulated concurrent worker leases on a single pending job: exactly 1 succeeds and 9 fail gracefully', async () => {
      // Enqueue exactly 1 pending job
      await enqueueJob(db, {
        id: 'contested_single_job',
        orgId: 'org_contested',
        tier: 'enterprise',
        lane: 'priority',
        priorityScore: 100,
        payload: { task: 'Atomic CAS Race' },
      });

      // Simulate 10 workers concurrently racing to lease the single job
      const workerCount = 10;
      const workerPromises = Array.from({ length: workerCount }, (_, index) =>
        leaseNextJob(db, `worker_race_${index + 1}`, 60),
      );

      const leaseResults = await Promise.all(workerPromises);

      const successfulLeases = leaseResults.filter((r) => r.leased === true);
      const failedLeases = leaseResults.filter((r) => r.leased === false);

      // Invariants guaranteed by atomic CAS:
      expect(successfulLeases).toHaveLength(1);
      expect(failedLeases).toHaveLength(9);

      const winner = successfulLeases[0];
      expect(winner.job?.id).toBe('contested_single_job');
      expect(winner.job?.status).toBe('leased');
      expect(winner.job?.leasedBy).toBeDefined();

      // All 9 losing workers must have received graceful NO_JOBS reason
      for (const failed of failedLeases) {
        expect(failed.reason).toBe('NO_JOBS');
      }

      // Verify database record has exactly the winning worker and updated status
      const dbJob = await getJobById(db, 'contested_single_job');
      expect(dbJob?.status).toBe('leased');
      expect(dbJob?.leasedBy).toBe(winner.job?.leasedBy);
    });

    it('empirical challenge: 20 concurrent workers racing across 5 pending jobs: exactly 5 succeed with zero duplicate job assignments', async () => {
      // Enqueue 5 jobs
      const jobIds = ['pool_job_1', 'pool_job_2', 'pool_job_3', 'pool_job_4', 'pool_job_5'];
      for (const id of jobIds) {
        await enqueueJob(db, {
          id,
          orgId: 'org_multi_race',
          tier: 'enterprise',
          lane: 'priority',
          priorityScore: 100,
          payload: { id },
        });
      }

      // 20 workers concurrently attempt to lease
      const workers = Array.from({ length: 20 }, (_, i) => `pool_worker_${i + 1}`);
      const results = await Promise.all(workers.map((w) => leaseNextJob(db, w, 60)));

      const successful = results.filter((r) => r.leased === true);
      const failed = results.filter((r) => r.leased === false);

      expect(successful).toHaveLength(5);
      expect(failed).toHaveLength(15);

      // Verify all 5 leased jobs are unique (NO double leasing)
      const assignedJobIds = successful.map((s) => s.job!.id);
      const uniqueJobIds = new Set(assignedJobIds);
      expect(uniqueJobIds.size).toBe(5);

      // Verify all 5 leased workers are unique
      const assignedWorkers = successful.map((s) => s.job!.leasedBy);
      const uniqueWorkers = new Set(assignedWorkers);
      expect(uniqueWorkers.size).toBe(5);
    });

    it('empirical challenge: expired lease recovery recovers crashed worker job and re-leases to healthy worker', async () => {
      const now = Math.floor(Date.now() / 1000);

      // Enqueue job
      await enqueueJob(db, {
        id: 'job_crashed_worker',
        orgId: 'org_crashed',
        tier: 'basic',
        lane: 'standard',
        priorityScore: 10,
        payload: { task: 'crash simulation' },
      });

      // Worker 1 leases job with 30s lease duration
      const initialLease = await leaseNextJob(db, 'crashed_worker_node', 30);
      expect(initialLease.leased).toBe(true);
      expect(initialLease.job?.id).toBe('job_crashed_worker');
      expect(initialLease.job?.leasedBy).toBe('crashed_worker_node');

      // Simulate worker crash: lease expired 30 seconds ago
      await db
        .prepare(`UPDATE video_render_jobs SET leased_until = ? WHERE id = ?`)
        .bind(now - 30, 'job_crashed_worker')
        .run();

      // Healthy worker 2 calls leaseNextJob: must recover the expired lease and lease it
      const recoveredLease = await leaseNextJob(db, 'healthy_worker_node', 60);
      expect(recoveredLease.leased).toBe(true);
      expect(recoveredLease.job?.id).toBe('job_crashed_worker');
      expect(recoveredLease.job?.leasedBy).toBe('healthy_worker_node');

      // Verify DB record
      const dbJob = await getJobById(db, 'job_crashed_worker');
      expect(dbJob?.status).toBe('leased');
      expect(dbJob?.leasedBy).toBe('healthy_worker_node');
    });

    it('empirical challenge: active (non-expired) lease is NOT recovered prematurely', async () => {
      const now = Math.floor(Date.now() / 1000);

      await enqueueJob(db, {
        id: 'job_active_healthy',
        orgId: 'org_active',
        tier: 'basic',
        lane: 'standard',
        priorityScore: 10,
        payload: {},
      });

      // Leased until now + 300s
      await leaseNextJob(db, 'busy_worker', 300);

      // Attempt recovery at current time
      const recoveredCount = await recoverExpiredLeases(db, now);
      expect(recoveredCount).toBe(0);

      // Job is still leased by busy_worker
      const job = await getJobById(db, 'job_active_healthy');
      expect(job?.status).toBe('leased');
      expect(job?.leasedBy).toBe('busy_worker');
    });
  });

  // =========================================================================
  // 3. GPU Mesh Circuit Breaker & Failover
  // =========================================================================
  describe('3. GPU Mesh Circuit Breaker & Failover', () => {
    let circuitBreaker: CircuitBreakerRegistry;
    let mockJob: VideoRenderJob;

    beforeEach(() => {
      circuitBreaker = new CircuitBreakerRegistry({
        failureThreshold: 3,
        successThreshold: 2,
        cooldownPeriodMs: 5000,
        executionTimeoutMs: 1000,
      });

      mockJob = {
        id: 'vrj_mesh_test_1',
        orgId: 'org_enterprise',
        lane: 'priority',
        priorityScore: 100,
        status: 'leased',
        tier: 'enterprise',
        payload: { prompt: 'High performance mesh' },
        retryCount: 0,
        maxRetries: 3,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      };
    });

    it('empirical challenge: provider failing 3 times trips circuit to OPEN and subsequent requests skip it', async () => {
      const now = Date.now();

      // Fail 1: remains CLOSED
      circuitBreaker.recordFailure('fal', new Error('Fal 500 Internal Error'), now);
      expect(circuitBreaker.getProviderStatus('fal', now).circuitState).toBe('CLOSED');
      expect(circuitBreaker.canAttempt('fal', now)).toBe(true);

      // Fail 2: remains CLOSED
      circuitBreaker.recordFailure('fal', new Error('Fal 502 Bad Gateway'), now);
      expect(circuitBreaker.getProviderStatus('fal', now).circuitState).toBe('CLOSED');
      expect(circuitBreaker.canAttempt('fal', now)).toBe(true);

      // Fail 3: hits threshold (3) -> trips to OPEN!
      circuitBreaker.recordFailure('fal', new Error('Fal 504 Gateway Timeout'), now);
      const openStatus = circuitBreaker.getProviderStatus('fal', now);
      expect(openStatus.circuitState).toBe('OPEN');
      expect(openStatus.healthy).toBe(false);
      expect(openStatus.cooldownUntil).toBe(now + 5000);
      expect(circuitBreaker.canAttempt('fal', now)).toBe(false);

      // Subsequent execution through mesh: fal MUST be skipped due to OPEN circuit
      let falExecuted = false;
      let runpodExecuted = false;

      const executors = {
        fal: async () => {
          falExecuted = true;
          return { videoUrl: 'https://fal.ai/video.mp4' };
        },
        runpod: async () => {
          runpodExecuted = true;
          return { videoUrl: 'https://runpod.io/video.mp4' };
        },
      };

      const result = await executeWithMeshFailover(mockJob, executors, ['fal', 'runpod'], {
        circuitBreaker,
      });

      // fal was NOT called
      expect(falExecuted).toBe(false);
      // runpod was executed and returned result
      expect(runpodExecuted).toBe(true);
      expect(result.provider).toBe('runpod');
      expect(result.result).toEqual({ videoUrl: 'https://runpod.io/video.mp4' });

      // Check attempt history contains skipped_circuit_open
      const falAttempt = result.attempts.find((a) => a.provider === 'fal');
      expect(falAttempt?.status).toBe('skipped_circuit_open');
    });

    it('empirical challenge: cooldown timer transitions OPEN to HALF_OPEN; success resets to CLOSED', () => {
      const now = 500000;

      // Trip RunPod to OPEN
      circuitBreaker.recordFailure('runpod', new Error('err1'), now);
      circuitBreaker.recordFailure('runpod', new Error('err2'), now);
      circuitBreaker.recordFailure('runpod', new Error('err3'), now);
      expect(circuitBreaker.getProviderStatus('runpod', now).circuitState).toBe('OPEN');

      // Before cooldown expiry (t = 504000 < 505000)
      expect(circuitBreaker.canAttempt('runpod', now + 4000)).toBe(false);

      // At cooldown expiry (t = 505000): transitions to HALF_OPEN and permits probe
      const probeAllowed = circuitBreaker.canAttempt('runpod', now + 5000);
      expect(probeAllowed).toBe(true);
      expect(circuitBreaker.getProviderStatus('runpod', now + 5000).circuitState).toBe('HALF_OPEN');

      // First successful probe: consecutiveSuccesses = 1 (threshold is 2, so remains HALF_OPEN)
      circuitBreaker.recordSuccess('runpod', 200, now + 5100);
      expect(circuitBreaker.getProviderStatus('runpod', now + 5100).circuitState).toBe('HALF_OPEN');

      // Second successful probe: reaches successThreshold (2) -> resets to CLOSED
      circuitBreaker.recordSuccess('runpod', 180, now + 5200);
      const recoveredStatus = circuitBreaker.getProviderStatus('runpod', now + 5200);
      expect(recoveredStatus.circuitState).toBe('CLOSED');
      expect(recoveredStatus.healthy).toBe(true);
      expect(recoveredStatus.cooldownUntil).toBeUndefined();
    });

    it('empirical challenge: probe failure during HALF_OPEN immediately re-trips circuit to OPEN', () => {
      const now = 500000;

      // Trip Replicate
      circuitBreaker.recordFailure('replicate', new Error('e1'), now);
      circuitBreaker.recordFailure('replicate', new Error('e2'), now);
      circuitBreaker.recordFailure('replicate', new Error('e3'), now);

      // Enter HALF_OPEN
      circuitBreaker.canAttempt('replicate', now + 5000);
      expect(circuitBreaker.getProviderStatus('replicate', now + 5000).circuitState).toBe('HALF_OPEN');

      // Probe FAILS -> immediately re-trips to OPEN without needing 3 failures
      circuitBreaker.recordFailure('replicate', new Error('Probe failed'), now + 5100);
      const reTrippedStatus = circuitBreaker.getProviderStatus('replicate', now + 5100);
      expect(reTrippedStatus.circuitState).toBe('OPEN');
      expect(reTrippedStatus.cooldownUntil).toBe(now + 5100 + 5000);
      expect(circuitBreaker.canAttempt('replicate', now + 5200)).toBe(false);
    });

    it('empirical challenge: complete mesh collapse (all 4 providers failing) throws AllProvidersFailedError cleanly', async () => {
      const executors = {
        fal: async () => {
          throw new Error('fal.ai 500 Internal Error');
        },
        runpod: async () => {
          throw new Error('runpod GPU out of VRAM');
        },
        replicate: async () => {
          throw new Error('replicate rate limit 429');
        },
        mekong: async () => {
          throw new Error('mekong GPU node offline');
        },
      };

      await expect(
        executeWithMeshFailover(mockJob, executors, ['fal', 'runpod', 'replicate', 'mekong'], {
          circuitBreaker,
        }),
      ).rejects.toThrow(AllProvidersFailedError);

      try {
        await executeWithMeshFailover(mockJob, executors, ['fal', 'runpod', 'replicate', 'mekong'], {
          circuitBreaker,
        });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AllProvidersFailedError);
        const collapseError = err as AllProvidersFailedError;
        expect(collapseError.jobId).toBe(mockJob.id);
        expect(collapseError.attempts).toHaveLength(4);
        expect(collapseError.attempts.map((a) => a.provider)).toEqual([
          'fal',
          'runpod',
          'replicate',
          'mekong',
        ]);
        for (const attempt of collapseError.attempts) {
          expect(attempt.status).toBe('failed');
          expect(attempt.error).toBeDefined();
        }
      }
    });
  });

  // =========================================================================
  // 4. DLQ & Alert Dispatching
  // =========================================================================
  describe('4. DLQ & Alert Dispatching', () => {
    it('empirical challenge: exponential backoff bounds and jitter mathematical invariants', () => {
      const baseMs = 1000;
      const maxMs = 60000;

      // Deterministic backoff without jitter
      expect(calculateExponentialBackoff(0, baseMs, maxMs, false)).toBe(1000);
      expect(calculateExponentialBackoff(1, baseMs, maxMs, false)).toBe(2000);
      expect(calculateExponentialBackoff(2, baseMs, maxMs, false)).toBe(4000);
      expect(calculateExponentialBackoff(3, baseMs, maxMs, false)).toBe(8000);
      expect(calculateExponentialBackoff(4, baseMs, maxMs, false)).toBe(16000);
      expect(calculateExponentialBackoff(5, baseMs, maxMs, false)).toBe(32000);
      expect(calculateExponentialBackoff(6, baseMs, maxMs, false)).toBe(60000); // capped at max
      expect(calculateExponentialBackoff(10, baseMs, maxMs, false)).toBe(60000); // capped at max

      // Negative retry count edge case safely bounds to retry 0
      expect(calculateExponentialBackoff(-3, baseMs, maxMs, false)).toBe(1000);

      // Jitter bounds: for 200 random samples, jitter must strictly satisfy [capped, capped * 1.10]
      for (let retries = 0; retries <= 8; retries++) {
        const deterministic = calculateExponentialBackoff(retries, baseMs, maxMs, false);
        const upperBound = Math.floor(deterministic * 1.1);

        for (let sample = 0; sample < 25; sample++) {
          const jittered = calculateExponentialBackoff(retries, baseMs, maxMs, true);
          expect(jittered).toBeGreaterThanOrEqual(deterministic);
          expect(jittered).toBeLessThanOrEqual(upperBound);
        }
      }
    });

    it('empirical challenge: retry count increments and transitions to DLQ upon exceeding max_retries with detailed dlq_reason', async () => {
      const jobId = 'vrj_retry_test_job';
      await enqueueJob(db, {
        id: jobId,
        orgId: 'org_retry_corp',
        tier: 'enterprise',
        lane: 'priority',
        priorityScore: 100,
        maxRetries: 3,
        payload: { task: 'render retry sequence' },
      });

      // Lease initial
      await leaseNextJob(db, 'worker_retry_node', 60);

      // Attempt 1 failure
      const fail1 = await failJob(db, jobId, 'Connection reset by peer');
      expect(fail1.status).toBe('queued');
      expect(fail1.retryCount).toBe(1);
      expect(fail1.shouldDlq).toBe(false);
      let jobState = await getJobById(db, jobId);
      expect(jobState?.status).toBe('queued');
      expect(jobState?.retryCount).toBe(1);
      expect(jobState?.leasedBy).toBeNull(); // Lease cleared for retry

      // Attempt 2 failure
      await leaseNextJob(db, 'worker_retry_node_2', 60);
      const fail2 = await failJob(db, jobId, 'GPU out of memory');
      expect(fail2.status).toBe('queued');
      expect(fail2.retryCount).toBe(2);
      expect(fail2.shouldDlq).toBe(false);

      // Attempt 3 failure: reaches max_retries (3) -> routes to DLQ!
      await leaseNextJob(db, 'worker_retry_node_3', 60);
      const fail3 = await failJob(db, jobId, 'CUDA kernel crash');
      expect(fail3.status).toBe('dlq');
      expect(fail3.retryCount).toBe(3);
      expect(fail3.shouldDlq).toBe(true);

      // Verify in DB
      jobState = await getJobById(db, jobId);
      expect(jobState?.status).toBe('dlq');
      expect(jobState?.dlqReason).toBe('MAX_RETRIES_EXCEEDED');
      expect(jobState?.errorMessage).toBe('CUDA kernel crash');
      expect(jobState?.leasedBy).toBeNull();
      expect(jobState?.leasedUntil).toBeNull();

      // Subsequent lease calls will NOT pick up this DLQ job
      const nextLease = await leaseNextJob(db, 'worker_post_dlq', 60);
      expect(nextLease.leased).toBe(false);
      expect(nextLease.reason).toBe('NO_JOBS');
    });

    it('empirical challenge: explicit routeJobToDlq routes job with custom terminal reason', async () => {
      const jobId = 'vrj_fatal_syntax_error';
      await enqueueJob(db, {
        id: jobId,
        orgId: 'org_syntax_error',
        tier: 'basic',
        lane: 'standard',
        priorityScore: 10,
        payload: {},
      });

      const dlqJob = await routeJobToDlq(db, jobId, 'INVALID_SPEC_SYNTAX', 'JSON schema validation failed');
      expect(dlqJob.status).toBe('dlq');
      expect(dlqJob.dlqReason).toBe('INVALID_SPEC_SYNTAX');
      expect(dlqJob.errorMessage).toBe('JSON schema validation failed');

      const dbRow = await getJobById(db, jobId);
      expect(dbRow?.status).toBe('dlq');
      expect(dbRow?.dlqReason).toBe('INVALID_SPEC_SYNTAX');
    });

    it('empirical challenge: alert dispatching handles missing credentials without crashing (logger fallback)', async () => {
      const alertPayload: DlqAlertPayload = {
        jobId: 'vrj_missing_creds_test',
        orgId: 'org_stealth',
        tier: 'pro',
        lane: 'standard',
        provider: 'fal',
        retryCount: 3,
        maxRetries: 3,
        dlqReason: 'MAX_RETRIES_EXCEEDED',
        errorMessage: 'Network timeout',
        failedAt: Math.floor(Date.now() / 1000),
      };

      // Ensure no env credentials set
      const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;
      const originalChatId = process.env.TELEGRAM_CHAT_ID;
      const originalWebhook = process.env.INCIDENT_WEBHOOK_URL;
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
      delete process.env.INCIDENT_WEBHOOK_URL;

      try {
        const dispatchResult = await dispatchDlqAlert(alertPayload, {});
        expect(dispatchResult.jobId).toBe(alertPayload.jobId);
        expect(dispatchResult.telegramSent).toBe(false);
        expect(dispatchResult.webhookSent).toBe(false);
        // Fallback to structured logger must be activated
        expect(dispatchResult.loggedFallback).toBe(true);
        expect(dispatchResult.errors).toEqual([]);
      } finally {
        if (originalBotToken) process.env.TELEGRAM_BOT_TOKEN = originalBotToken;
        if (originalChatId) process.env.TELEGRAM_CHAT_ID = originalChatId;
        if (originalWebhook) process.env.INCIDENT_WEBHOOK_URL = originalWebhook;
      }
    });

    it('empirical challenge: alert dispatching survives downstream HTTP 500 without unhandled rejection', async () => {
      const alertPayload: DlqAlertPayload = {
        jobId: 'vrj_http_error_test',
        orgId: 'org_failing_endpoint',
        tier: 'enterprise',
        lane: 'priority',
        retryCount: 3,
        maxRetries: 3,
        dlqReason: 'MAX_RETRIES_EXCEEDED',
        errorMessage: 'Fatal crash',
        failedAt: Math.floor(Date.now() / 1000),
      };

      // Mock fetch returning HTTP 502 for Telegram and 500 for Webhook
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('telegram')) {
          return new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
        }
        return new Response('Internal Server Error', { status: 500, statusText: 'Internal Error' });
      });

      const result = await dispatchDlqAlert(alertPayload, {
        telegramBotToken: 'mock_token',
        telegramChatId: 'mock_chat_id',
        incidentWebhookUrl: 'https://incident.example.com/webhook',
      });

      expect(result.telegramSent).toBe(false);
      expect(result.webhookSent).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.some((e) => e.includes('502'))).toBe(true);
      expect(result.errors?.some((e) => e.includes('500'))).toBe(true);

      fetchSpy.mockRestore();
    });

    it('empirical challenge: alert dispatching succeeds on 200 responses for both channels', async () => {
      const alertPayload: DlqAlertPayload = {
        jobId: 'vrj_success_alert_test',
        orgId: 'org_alert_success',
        tier: 'master',
        lane: 'priority',
        retryCount: 3,
        maxRetries: 3,
        dlqReason: 'MAX_RETRIES_EXCEEDED',
        errorMessage: 'Job terminated',
        failedAt: Math.floor(Date.now() / 1000),
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      const result = await dispatchDlqAlert(alertPayload, {
        telegramBotToken: 'mock_token',
        telegramChatId: 'mock_chat_id',
        incidentWebhookUrl: 'https://incident.example.com/webhook',
      });

      expect(result.telegramSent).toBe(true);
      expect(result.webhookSent).toBe(true);
      expect(result.loggedFallback).toBe(false);
      expect(result.errors).toHaveLength(0);

      fetchSpy.mockRestore();
    });
  });
});
