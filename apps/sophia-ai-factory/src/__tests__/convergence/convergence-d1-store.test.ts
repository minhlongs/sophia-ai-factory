/**
 * Real SQLite Schema & Route Integration Test for Migration 0494
 * (`0494_authoritative_job_convergence_ledger.sql` + `convergence-d1-store.ts` + `/api/convergence/vertical-slice`)
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';
import {
  acquireConvergenceLeaseD1,
  createOrGetConvergenceJobD1,
  getConvergenceJobByIdD1,
  listConvergenceJobsByWorkspaceD1,
  transitionConvergenceCasD1,
} from '@/tree/convergence';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  verifyWorkspaceAccess: vi.fn(),
  getD1: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/seed/auth/workspace-access', () => ({ verifyWorkspaceAccess: mocks.verifyWorkspaceAccess }));
vi.mock('@/seed/db/client', () => ({ getD1: mocks.getD1 }));

import { POST as postVerticalSlice, GET as getVerticalSlice } from '@/app/api/convergence/vertical-slice/route';

const MIGRATION_0494_PATH = path.resolve(
  process.cwd(),
  'migrations/0494_authoritative_job_convergence_ledger.sql'
);
const MIGRATION_0494_SQL = fs.readFileSync(MIGRATION_0494_PATH, 'utf8');

describe('Migration 0494 + Convergence D1 Store + /api/convergence/vertical-slice (Real SQLite)', () => {
  let d1: D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    const raw = freshDb();
    raw.exec(MIGRATION_0494_SQL);
    d1 = makeD1(raw) as unknown as D1Database;
    mocks.getD1.mockResolvedValue(d1);
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_alpha', email: 'alpha@example.com' });
    mocks.verifyWorkspaceAccess.mockImplementation(
      async (wsId: string, userId: string) =>
        (wsId === 'ws_alpha' && userId === 'user_alpha') ||
        (wsId === 'ws_beta' && userId === 'user_beta')
    );
  });

  it('persists 26 columns, deduplicates idempotent keys per workspace, and blocks cross-tenant jobId collisions in D1', async () => {
    const first = await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_d1_1',
      workspaceId: 'ws_alpha',
      userId: 'user_alpha',
      idempotencyKey: 'idem_shared',
      estimatedCostUsd: 0.77,
      nowMs: 1000,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.deduplicated).toBe(false);
    expect(first.value.record.lifecycleStage).toBe('creative_mission_intake');

    const replay = await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_d1_2',
      workspaceId: 'ws_alpha',
      userId: 'user_alpha',
      idempotencyKey: 'idem_shared',
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.value.deduplicated).toBe(true);
      expect(replay.value.record.jobId).toBe('job_d1_1');
    }

    const collideId = await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_d1_1',
      workspaceId: 'ws_beta',
      userId: 'user_beta',
      idempotencyKey: 'idem_other',
    });
    expect(collideId.ok).toBe(false);
    if (!collideId.ok) expect(collideId.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('enforces lease TTL, atomic CAS version increments, and cross-tenant isolation in SQL', async () => {
    await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_cas_1',
      workspaceId: 'ws_alpha',
      userId: 'user_alpha',
      idempotencyKey: 'idem_cas_1',
      nowMs: 1000,
    });

    const leaseA = await acquireConvergenceLeaseD1(d1, 'job_cas_1', 'ws_alpha', 'worker_a', 10000, 2000);
    expect(leaseA.ok).toBe(true);
    if (!leaseA.ok) return;
    expect(leaseA.value.version).toBe(2);

    const contender = await acquireConvergenceLeaseD1(d1, 'job_cas_1', 'ws_alpha', 'worker_b', 10000, 5000);
    expect(contender.ok).toBe(false);
    if (!contender.ok) expect(contender.error.code).toBe('LEASE_HELD');

    const crossTenant = await getConvergenceJobByIdD1(d1, 'job_cas_1', 'ws_beta');
    expect(crossTenant.ok).toBe(false);
    if (!crossTenant.ok) expect(crossTenant.error.code).toBe('TENANT_MISMATCH');

    const casOk = await transitionConvergenceCasD1(d1, {
      jobId: 'job_cas_1',
      workspaceId: 'ws_alpha',
      expectedVersion: 2,
      leaseToken: 'worker_a',
      nowMs: 6000,
      lifecycleStage: 'media_render_dispatch',
      mekongJobId: 'mk_ticket_99',
      actualCostUsd: 0.42,
      axes: { executionOutcome: 'running' },
    });
    expect(casOk.ok).toBe(true);
    if (casOk.ok) {
      expect(casOk.value.version).toBe(3);
      expect(casOk.value.mekongJobId).toBe('mk_ticket_99');
      expect(casOk.value.lifecycleStage).toBe('media_render_dispatch');
    }
  });

  it('executes POST /api/convergence/vertical-slice and persists across stateless GET requests in D1', async () => {
    const postReq = new NextRequest('http://localhost/api/convergence/vertical-slice', {
      method: 'POST',
      body: JSON.stringify({
        jobId: 'job_api_1',
        workspaceId: 'ws_alpha',
        idempotencyKey: 'idem_api_1',
        goal: 'Launch verified affiliate campaign video',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const postRes = await postVerticalSlice(postReq);
    expect(postRes.status).toBe(200);
    const postJson = (await postRes.json()) as {
      truthState: { isTrulyComplete: boolean };
      record: { mekongJobId: string | null; artifactManifest: unknown[] };
    };
    expect(postJson.truthState.isTrulyComplete).toBe(true);
    expect(postJson.record.mekongJobId).toBeTruthy();
    expect(postJson.record.artifactManifest.length).toBe(5);

    const rowsInD1 = await listConvergenceJobsByWorkspaceD1(d1, 'ws_alpha');
    expect(rowsInD1.length).toBe(1);
    expect(rowsInD1[0].jobId).toBe('job_api_1');
    expect(rowsInD1[0].lifecycleStage).toBe('converged_terminal');

    const getReq = new NextRequest(
      'http://localhost/api/convergence/vertical-slice?workspaceId=ws_alpha&jobId=job_api_1'
    );
    const getRes = await getVerticalSlice(getReq);
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as {
      record: { jobId: string };
      truthState: { overallStatus: string };
      unitEconomics: { verificationYield: number };
    };
    expect(getJson.record.jobId).toBe('job_api_1');
    expect(getJson.truthState.overallStatus).toBe('converged');
    expect(getJson.unitEconomics.verificationYield).toBe(1);

    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user_beta', email: 'beta@example.com' });
    const crossTenantGet = new NextRequest(
      'http://localhost/api/convergence/vertical-slice?workspaceId=ws_beta&jobId=job_api_1'
    );
    const crossRes = await getVerticalSlice(crossTenantGet);
    expect(crossRes.status).toBe(403);
  });
});
