/**
 * Fair-Share GPU Scheduler & Two-Lane Queue Arbitration Tests
 *
 * Validates:
 * - Two-lane queue arbitration (Priority Lane vs Standard Lane)
 * - Priority scoring by tier (Enterprise: 100, Master: 200, Pro: 25, Basic: 10)
 * - Tenant concurrency throttling (limits active renders per org)
 * - Atomic job leasing with CAS concurrency protection
 * - Lease renewal and expired lease recovery
 * - State machine transitions (queued -> leased -> rendering -> completed / failed / dlq)
 * - Queue metrics aggregation
 *
 * Layer: tree/queue/__tests__
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import {
  enqueueJob,
  leaseNextJob,
  renewLease,
  markJobRendering,
  completeJob,
  failJob,
  cancelJob,
  getJobById,
  getQueueMetrics,
  recoverExpiredLeases,
  getTenantActiveRenderCount,
  getTenantConcurrencyLimit,
} from '../fair-share-gpu-scheduler';
import { DEFAULT_SCHEDULER_CONFIG } from '@/seed/types/video-render-queue';

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
          return row ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

describe('Fair-Share GPU Scheduler Service', () => {
  let db: D1Database;
  const ORG_ENTERPRISE = 'org_enterprise_100';
  const ORG_BASIC = 'org_basic_200';
  const ORG_MASTER = 'org_master_300';

  beforeEach(async () => {
    db = createTestD1();

    // Seed mock organizations
    await db
      .prepare('INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?), (?, ?)')
      .bind(
        ORG_ENTERPRISE, 'Acme Enterprise Media',
        ORG_BASIC, 'Solopreneur Studio',
        ORG_MASTER, 'Global Master Agency',
      )
      .run();
  });

  describe('enqueueJob', () => {
    it('automatically assigns priority lane and score 100 for enterprise tier', async () => {
      const job = await enqueueJob(db, {
        orgId: ORG_ENTERPRISE,
        tier: 'enterprise',
        payload: { prompt: 'Epic sci-fi teaser', durationSec: 15 },
      });

      expect(job.id).toMatch(/^vrj_/);
      expect(job.lane).toBe('priority');
      expect(job.priorityScore).toBe(100);
      expect(job.status).toBe('queued');
      expect(job.retryCount).toBe(0);
      expect(job.maxRetries).toBe(3);
    });

    it('automatically assigns priority lane and score 200 for master tier', async () => {
      const job = await enqueueJob(db, {
        orgId: ORG_MASTER,
        tier: 'MASTER',
        payload: { prompt: '4K commercial campaign' },
      });

      expect(job.lane).toBe('priority');
      expect(job.priorityScore).toBe(200);
    });

    it('assigns standard lane and score 10 for basic / starter tier', async () => {
      const job = await enqueueJob(db, {
        orgId: ORG_BASIC,
        tier: 'basic',
        payload: 'raw text payload',
      });

      expect(job.lane).toBe('standard');
      expect(job.priorityScore).toBe(10);
    });

    it('preserves subaccount_id and preferred provider', async () => {
      const job = await enqueueJob(db, {
        orgId: ORG_ENTERPRISE,
        subaccountId: 'sub_client_xyz',
        tier: 'enterprise',
        preferredProvider: 'runpod',
        payload: { model: 'hunyuan-video' },
      });

      expect(job.subaccountId).toBe('sub_client_xyz');
      expect(job.provider).toBe('runpod');
    });
  });

  describe('Two-Lane Queue Arbitration & Ordering', () => {
    it('services Priority Lane jobs before Standard Lane jobs', async () => {
      // Enqueue basic job first
      const basicJob = await enqueueJob(db, {
        orgId: ORG_BASIC,
        tier: 'basic',
        payload: { title: 'Basic video' },
      });

      // Enqueue enterprise job later
      const enterpriseJob = await enqueueJob(db, {
        orgId: ORG_ENTERPRISE,
        tier: 'enterprise',
        payload: { title: 'Enterprise video' },
      });

      // Lease next job without preference -> Priority lane must be leased first!
      const lease1 = await leaseNextJob(db, 'worker_gpu_1', 60);
      expect(lease1.leased).toBe(true);
      expect(lease1.job?.id).toBe(enterpriseJob.id);
      expect(lease1.job?.lane).toBe('priority');

      // Next lease gets the standard lane job
      const lease2 = await leaseNextJob(db, 'worker_gpu_2', 60);
      expect(lease2.leased).toBe(true);
      expect(lease2.job?.id).toBe(basicJob.id);
      expect(lease2.job?.lane).toBe('standard');
    });

    it('orders by priority_score descending within the same lane', async () => {
      // Enqueue Enterprise (100) first
      await enqueueJob(db, {
        orgId: ORG_ENTERPRISE,
        tier: 'enterprise',
        payload: { title: 'Enterprise job 100' },
      });

      // Enqueue Master (200) second
      const masterJob = await enqueueJob(db, {
        orgId: ORG_MASTER,
        tier: 'master',
        payload: { title: 'Master job 200' },
      });

      const lease = await leaseNextJob(db, 'worker_gpu_1', 60);
      expect(lease.leased).toBe(true);
      expect(lease.job?.id).toBe(masterJob.id);
      expect(lease.job?.priorityScore).toBe(200);
    });

    it('respects lanePreference when explicitly requested by worker', async () => {
      await enqueueJob(db, {
        orgId: ORG_ENTERPRISE,
        tier: 'enterprise',
        payload: { title: 'Enterprise job' },
      });

      const standardJob = await enqueueJob(db, {
        orgId: ORG_BASIC,
        tier: 'basic',
        payload: { title: 'Standard job' },
      });

      // Explicitly ask for standard lane
      const lease = await leaseNextJob(db, 'worker_gpu_std', 60, 'standard');
      expect(lease.leased).toBe(true);
      expect(lease.job?.id).toBe(standardJob.id);
      expect(lease.job?.lane).toBe('standard');
    });
  });

  describe('Tenant Concurrency Throttling', () => {
    it('limits active renders per organization and skips throttled tenants', async () => {
      const customConfig = {
        maxActiveRendersPerTenant: {
          default: 2,
          basic: 2,
          starter: 2,
          pro: 4,
          agency: 5,
          enterprise: 5,
          master: 10,
        },
      };

      // Enqueue 3 jobs for Basic org (limit is 2)
      await enqueueJob(db, { orgId: ORG_BASIC, tier: 'basic', payload: '1' });
      await enqueueJob(db, { orgId: ORG_BASIC, tier: 'basic', payload: '2' });
      await enqueueJob(db, { orgId: ORG_BASIC, tier: 'basic', payload: '3' });

      // Enqueue 1 job for Enterprise org
      const entJob = await enqueueJob(db, { orgId: ORG_ENTERPRISE, tier: 'enterprise', payload: 'ent-1' });

      // Worker 1 leases job 1 for Basic
      const l1 = await leaseNextJob(db, 'w1', 60, 'standard', customConfig);
      expect(l1.leased).toBe(true);

      // Worker 2 leases job 2 for Basic -> Basic org now has 2 active renders (limit reached!)
      const l2 = await leaseNextJob(db, 'w2', 60, 'standard', customConfig);
      expect(l2.leased).toBe(true);

      // Worker 3 requests next job: Basic's 3rd job is skipped because Basic hit its limit (2).
      // The scheduler instead leases the Enterprise job!
      const l3 = await leaseNextJob(db, 'w3', 60, undefined, customConfig);
      expect(l3.leased).toBe(true);
      expect(l3.job?.id).toBe(entJob.id);
      expect(l3.job?.orgId).toBe(ORG_ENTERPRISE);

      // Worker 4 requests next job: only remaining job is Basic's 3rd job, which is throttled
      const l4 = await leaseNextJob(db, 'w4', 60, 'standard', customConfig);
      expect(l4.leased).toBe(false);
      expect(l4.reason).toBe('TENANT_CONCURRENCY_LIMIT');
    });

    it('calculates correct concurrency limits by tier', () => {
      expect(getTenantConcurrencyLimit('basic')).toBe(5);
      expect(getTenantConcurrencyLimit('starter')).toBe(5);
      expect(getTenantConcurrencyLimit('pro')).toBe(8);
      expect(getTenantConcurrencyLimit('enterprise')).toBe(15);
      expect(getTenantConcurrencyLimit('master')).toBe(15);
      expect(getTenantConcurrencyLimit('unknown')).toBe(5);
    });

    it('measures active renders accurately', async () => {
      const now = Math.floor(Date.now() / 1000);
      const job1 = await enqueueJob(db, { orgId: ORG_BASIC, tier: 'basic', payload: '1' });
      const job2 = await enqueueJob(db, { orgId: ORG_BASIC, tier: 'basic', payload: '2' });

      expect(await getTenantActiveRenderCount(db, ORG_BASIC, now)).toBe(0);

      await leaseNextJob(db, 'w1', 60);
      expect(await getTenantActiveRenderCount(db, ORG_BASIC, now)).toBe(1);

      await markJobRendering(db, job1.id, 'w1', 'fal');
      expect(await getTenantActiveRenderCount(db, ORG_BASIC, now)).toBe(1);

      await completeJob(db, job1.id, 'https://cdn.r2/vid1.mp4');
      expect(await getTenantActiveRenderCount(db, ORG_BASIC, now)).toBe(0);
    });
  });

  describe('Atomic Leasing, Renewal & Expired Leases', () => {
    it('renews lease for the owning worker', async () => {
      const job = await enqueueJob(db, { orgId: ORG_ENTERPRISE, tier: 'enterprise', payload: 'video' });
      const lease = await leaseNextJob(db, 'worker_alpha', 60);

      expect(lease.leased).toBe(true);

      const renewed = await renewLease(db, job.id, 'worker_alpha', 120);
      expect(renewed).toBe(true);

      // Wrong worker cannot renew
      const wrongWorker = await renewLease(db, job.id, 'worker_impostor', 120);
      expect(wrongWorker).toBe(false);
    });

    it('recovers expired leases back to queued state', async () => {
      const now = Math.floor(Date.now() / 1000);
      const job = await enqueueJob(db, { orgId: ORG_BASIC, tier: 'basic', payload: 'video' });

      // Simulate lease that expired 10 seconds ago
      await db
        .prepare(
          `UPDATE video_render_jobs
           SET status = 'leased', leased_by = 'crashed_worker', leased_until = ?
           WHERE id = ?`,
        )
        .bind(now - 10, job.id)
        .run();

      const recovered = await recoverExpiredLeases(db, now);
      expect(recovered).toBe(1);

      const reloaded = await getJobById(db, job.id);
      expect(reloaded?.status).toBe('queued');
      expect(reloaded?.leasedBy).toBeNull();
      expect(reloaded?.leasedUntil).toBeNull();

      // Now another worker can lease it cleanly
      const newLease = await leaseNextJob(db, 'worker_beta', 60);
      expect(newLease.leased).toBe(true);
      expect(newLease.job?.id).toBe(job.id);
    });
  });

  describe('State Machine Transitions', () => {
    it('transitions job through full lifecycle: queued -> leased -> rendering -> completed', async () => {
      const job = await enqueueJob(db, { orgId: ORG_ENTERPRISE, tier: 'enterprise', payload: { spec: 1 } });
      expect(job.status).toBe('queued');

      const lease = await leaseNextJob(db, 'worker_1', 60);
      expect(lease.job?.status).toBe('leased');

      const rendering = await markJobRendering(db, job.id, 'worker_1', 'fal');
      expect(rendering).toBe(true);

      const inFlight = await getJobById(db, job.id);
      expect(inFlight?.status).toBe('rendering');
      expect(inFlight?.provider).toBe('fal');

      const completed = await completeJob(db, job.id, 'https://r2.storage/final.mp4');
      expect(completed).toBe(true);

      const finalJob = await getJobById(db, job.id);
      expect(finalJob?.status).toBe('completed');
      expect(finalJob?.resultUrl).toBe('https://r2.storage/final.mp4');
      expect(finalJob?.leasedBy).toBeNull();
    });

    it('increments retry count on transient failure and re-queues', async () => {
      const job = await enqueueJob(db, { orgId: ORG_BASIC, tier: 'basic', payload: 'test' });
      await leaseNextJob(db, 'worker_1', 60);

      const failResult = await failJob(db, job.id, '504 Gateway Timeout from GPU provider');
      expect(failResult.status).toBe('queued');
      expect(failResult.retryCount).toBe(1);
      expect(failResult.shouldDlq).toBe(false);

      const reloaded = await getJobById(db, job.id);
      expect(reloaded?.status).toBe('queued');
      expect(reloaded?.retryCount).toBe(1);
      expect(reloaded?.errorMessage).toBe('504 Gateway Timeout from GPU provider');
    });

    it('routes to DLQ when retry count exceeds max_retries', async () => {
      const job = await enqueueJob(db, {
        orgId: ORG_BASIC,
        tier: 'basic',
        maxRetries: 2,
        payload: 'test',
      });

      // Attempt 1 fails -> queued
      await leaseNextJob(db, 'w1', 60);
      await failJob(db, job.id, 'Error 1');

      // Attempt 2 fails -> reaches max_retries (2) -> DLQ!
      await leaseNextJob(db, 'w2', 60);
      const fail2 = await failJob(db, job.id, 'Fatal GPU memory allocation failure');

      expect(fail2.status).toBe('dlq');
      expect(fail2.retryCount).toBe(2);
      expect(fail2.shouldDlq).toBe(true);

      const dlqJob = await getJobById(db, job.id);
      expect(dlqJob?.status).toBe('dlq');
      expect(dlqJob?.dlqReason).toBe('MAX_RETRIES_EXCEEDED');
      expect(dlqJob?.errorMessage).toBe('Fatal GPU memory allocation failure');
    });

    it('cancels pending and leased jobs with tenant isolation', async () => {
      const job = await enqueueJob(db, { orgId: ORG_ENTERPRISE, tier: 'enterprise', payload: 'to cancel' });

      // Wrong org cannot cancel
      const wrongOrgCancel = await cancelJob(db, job.id, 'org_impostor');
      expect(wrongOrgCancel).toBe(false);

      // Correct org cancels successfully
      const cancelled = await cancelJob(db, job.id, ORG_ENTERPRISE);
      expect(cancelled).toBe(true);

      const cancelledJob = await getJobById(db, job.id);
      expect(cancelledJob?.status).toBe('failed');
      expect(cancelledJob?.errorMessage).toContain('Cancelled');
    });
  });

  describe('Queue Metrics Aggregator', () => {
    it('aggregates counts by lane and status accurately', async () => {
      // 2 priority queued
      await enqueueJob(db, { orgId: ORG_ENTERPRISE, tier: 'enterprise', payload: '1' });
      await enqueueJob(db, { orgId: ORG_MASTER, tier: 'master', payload: '2' });

      // 1 standard queued
      const stdJob = await enqueueJob(db, { orgId: ORG_BASIC, tier: 'basic', payload: '3' });

      // Lease and complete 1 standard job
      await leaseNextJob(db, 'w1', 60, 'standard');
      await completeJob(db, stdJob.id, 'https://cdn/done.mp4');

      const metrics = await getQueueMetrics(db);
      expect(metrics.priority.queued).toBe(2);
      expect(metrics.standard.completed).toBe(1);
      expect(metrics.totalQueued).toBe(2);
      expect(metrics.totalActive).toBe(0);
    });
  });
});
