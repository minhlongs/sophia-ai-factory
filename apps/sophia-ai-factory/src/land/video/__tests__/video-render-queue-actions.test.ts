/**
 * Video Render Queue Server Actions Test Suite
 *
 * Validates:
 * - Authentication enforcement via getCurrentUser()
 * - Automatic priority lane & score assignment based on subscription tier (Enterprise -> Priority 100, Master -> Priority 200)
 * - Multi-tenant isolation for job lookup and cancellation
 * - Worker leasing server action
 *
 * Layer: land/video/__tests__
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';

// Mock dependencies
const mockGetCurrentUser = vi.fn();
const mockGetD1 = vi.fn();
const mockGetUserTier = vi.fn();
const mockResolveOrgId = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: () => mockGetD1(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: (userId: string) => mockGetUserTier(userId),
}));

vi.mock('@/seed/auth/resolve-org-id', () => ({
  resolveOrgId: (userId: string, db: unknown) => mockResolveOrgId(userId, db),
}));

import {
  enqueueVideoRenderJobAction,
  getQueueStatusAction,
  cancelVideoJobAction,
  leaseNextJobAction,
} from '../video-render-queue-actions';

function createTestD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
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
      provider TEXT,
      dlq_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
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
          return { results, meta: { changes: 0, duration: 1 } };
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

describe('Video Render Queue Server Actions', () => {
  let db: D1Database;

  const mockUser = {
    id: 'usr_enterprise_ceo',
    email: 'ceo@agencyos.network',
    name: 'Enterprise Founder',
  };

  const ORG_A = 'org_scale_engine_alpha';
  const ORG_B = 'org_other_tenant_beta';

  beforeEach(() => {
    db = createTestD1();
    mockGetD1.mockResolvedValue(db);
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockGetUserTier.mockResolvedValue('BASIC');
    mockResolveOrgId.mockResolvedValue(ORG_A);
  });

  describe('enqueueVideoRenderJobAction', () => {
    it('returns unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValueOnce(null);

      const result = await enqueueVideoRenderJobAction({
        payload: { script: 'Hello Sophia' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('unauthorized');
    });

    it('assigns Priority Lane and priority_score 100 for ENTERPRISE tier', async () => {
      mockGetUserTier.mockResolvedValueOnce('ENTERPRISE');

      const result = await enqueueVideoRenderJobAction({
        payload: { script: 'Enterprise video prompt' },
        subaccountId: 'sub_client_01',
      });

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      expect(result.job?.lane).toBe('priority');
      expect(result.job?.priorityScore).toBe(100);
      expect(result.job?.tier).toBe('ENTERPRISE');
      expect(result.job?.orgId).toBe(ORG_A);
      expect(result.job?.subaccountId).toBe('sub_client_01');
    });

    it('assigns Priority Lane and priority_score 200 for MASTER tier', async () => {
      mockGetUserTier.mockResolvedValueOnce('MASTER');

      const result = await enqueueVideoRenderJobAction({
        payload: { script: 'Master video prompt' },
      });

      expect(result.success).toBe(true);
      expect(result.job?.lane).toBe('priority');
      expect(result.job?.priorityScore).toBe(200);
    });

    it('assigns Standard Lane and priority_score 10 for BASIC tier', async () => {
      mockGetUserTier.mockResolvedValueOnce('BASIC');

      const result = await enqueueVideoRenderJobAction({
        payload: { script: 'Basic video prompt' },
      });

      expect(result.success).toBe(true);
      expect(result.job?.lane).toBe('standard');
      expect(result.job?.priorityScore).toBe(10);
    });

    it('assigns Standard Lane and priority_score 25 for PRO / PREMIUM tier', async () => {
      mockGetUserTier.mockResolvedValueOnce('PRO');

      const result = await enqueueVideoRenderJobAction({
        payload: { script: 'Pro video prompt' },
      });

      expect(result.success).toBe(true);
      expect(result.job?.lane).toBe('standard');
      expect(result.job?.priorityScore).toBe(25);
    });
  });

  describe('getQueueStatusAction', () => {
    it('returns queue metrics when no jobId is provided', async () => {
      mockGetUserTier.mockResolvedValueOnce('ENTERPRISE');
      await enqueueVideoRenderJobAction({ payload: 'job 1' });

      const result = await getQueueStatusAction();

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.totalQueued).toBe(1);
      expect(result.metrics?.priority.queued).toBe(1);
    });

    it('returns specific job details when belonging to tenant organization', async () => {
      mockGetUserTier.mockResolvedValueOnce('ENTERPRISE');
      const enq = await enqueueVideoRenderJobAction({ payload: 'job alpha' });
      const jobId = enq.job!.id;

      const result = await getQueueStatusAction(jobId);

      expect(result.success).toBe(true);
      expect(result.job?.id).toBe(jobId);
      expect(result.job?.orgId).toBe(ORG_A);
    });

    it('enforces tenant isolation and returns job_not_found for foreign org job', async () => {
      // Enqueue a job belonging to ORG_B
      mockResolveOrgId.mockResolvedValueOnce(ORG_B);
      const enq = await enqueueVideoRenderJobAction({ payload: 'foreign job' });
      const foreignJobId = enq.job!.id;

      // Current user is in ORG_A
      mockResolveOrgId.mockResolvedValue(ORG_A);
      const result = await getQueueStatusAction(foreignJobId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('job_not_found');
    });
  });

  describe('cancelVideoJobAction', () => {
    it('cancels job belonging to the caller organization', async () => {
      mockGetUserTier.mockResolvedValueOnce('BASIC');
      const enq = await enqueueVideoRenderJobAction({ payload: 'to cancel' });
      const jobId = enq.job!.id;

      const result = await cancelVideoJobAction(jobId);

      expect(result.success).toBe(true);

      const status = await getQueueStatusAction(jobId);
      expect(status.job?.status).toBe('failed');
      expect(status.job?.errorMessage).toContain('Cancelled');
    });

    it('rejects cancellation of a job belonging to a different tenant', async () => {
      // Enqueue job for ORG_B
      mockResolveOrgId.mockResolvedValueOnce(ORG_B);
      const enq = await enqueueVideoRenderJobAction({ payload: 'foreign cancel' });
      const foreignJobId = enq.job!.id;

      // Caller is in ORG_A
      mockResolveOrgId.mockResolvedValue(ORG_A);
      const result = await cancelVideoJobAction(foreignJobId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('job_not_cancellable_or_not_found');
    });
  });

  describe('leaseNextJobAction', () => {
    it('leases next job successfully for an active worker', async () => {
      mockGetUserTier.mockResolvedValueOnce('ENTERPRISE');
      const enq = await enqueueVideoRenderJobAction({ payload: 'work item' });

      const leaseResult = await leaseNextJobAction('worker_node_42', 60);

      expect(leaseResult.success).toBe(true);
      expect(leaseResult.result?.leased).toBe(true);
      expect(leaseResult.result?.job?.id).toBe(enq.job!.id);
      expect(leaseResult.result?.job?.leasedBy).toBe('worker_node_42');
    });
  });
});
