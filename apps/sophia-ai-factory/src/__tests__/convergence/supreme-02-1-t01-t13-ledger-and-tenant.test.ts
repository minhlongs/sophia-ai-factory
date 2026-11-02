/**
 * Supreme Command #02.1 Regression Suite — Part 1: T01 through T13 + T19
 *
 * Tests real SQLite D1 state machine invariants (`0494_authoritative_job_convergence_ledger.sql`),
 * lease ownership, CAS conflict handling, terminal state immutability, and workspace tenant
 * isolation across create, read, artifact retrieval, cancel, and approval actions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';
import {
  acquireConvergenceLeaseD1,
  cancelConvergenceJobD1,
  createOrGetConvergenceJobD1,
  decideConvergenceApprovalD1,
  getConvergenceArtifactByIdD1,
  getConvergenceJobByIdD1,
  transitionConvergenceCasD1,
} from '@/tree/convergence';

const MIGRATION_0494_SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'migrations/0494_authoritative_job_convergence_ledger.sql'),
  'utf8'
);

describe('Supreme Command #02.1 — T01..T13 & T19: D1 Ledger Invariants & Tenant Isolation', () => {
  let d1: D1Database;

  beforeEach(() => {
    const raw = freshDb();
    raw.exec(MIGRATION_0494_SQL);
    d1 = makeD1(raw) as unknown as D1Database;
  });

  it('T01 & T02 & T10: same workspace idempotency returns same job; different workspace same key creates separate job; cross-workspace jobId collision fails closed', async () => {
    const a1 = await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_t01_a', workspaceId: 'ws_alpha', userId: 'u_alpha', idempotencyKey: 'idem_shared_key', nowMs: 1000,
    });
    expect(a1.ok).toBe(true);
    if (!a1.ok) return;
    expect(a1.value.deduplicated).toBe(false);

    const a2 = await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_t01_a_dup', workspaceId: 'ws_alpha', userId: 'u_alpha', idempotencyKey: 'idem_shared_key', nowMs: 1005,
    });
    expect(a2.ok && a2.value.deduplicated).toBe(true);
    if (a2.ok) expect(a2.value.record.jobId).toBe('job_t01_a');

    const b1 = await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_t02_b', workspaceId: 'ws_beta', userId: 'u_beta', idempotencyKey: 'idem_shared_key', nowMs: 1010,
    });
    expect(b1.ok && !b1.value.deduplicated).toBe(true);
    if (b1.ok) expect(b1.value.record.workspaceId).toBe('ws_beta');

    const collision = await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_t01_a', workspaceId: 'ws_beta', userId: 'u_beta', idempotencyKey: 'idem_other', nowMs: 1020,
    });
    expect(collision.ok).toBe(false);
    if (!collision.ok) expect(collision.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('T03 & T05 & T06 & T07: enforces single lease winner, expired lease takeover, stale lease rejection, and CAS version conflict', async () => {
    await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_lease_1', workspaceId: 'ws_alpha', userId: 'u_alpha', idempotencyKey: 'idem_lease_1', nowMs: 1000,
    });

    const w1 = await acquireConvergenceLeaseD1(d1, 'job_lease_1', 'ws_alpha', 'lease_worker_1', 5000, 1000);
    const w2 = await acquireConvergenceLeaseD1(d1, 'job_lease_1', 'ws_alpha', 'lease_worker_2', 5000, 2000);
    expect(w1.ok).toBe(true);
    expect(w2.ok).toBe(false);
    if (!w2.ok) expect(w2.error.code).toBe('LEASE_HELD');

    const takeover = await acquireConvergenceLeaseD1(d1, 'job_lease_1', 'ws_alpha', 'lease_worker_2', 5000, 7000);
    expect(takeover.ok).toBe(true);
    if (!takeover.ok) return;
    expect(takeover.value.version).toBe(3);

    const staleWorker1 = await transitionConvergenceCasD1(d1, {
      jobId: 'job_lease_1', workspaceId: 'ws_alpha', expectedVersion: 3, leaseToken: 'lease_worker_1', nowMs: 7500,
      lifecycleStage: 'niche_video_plan',
    });
    expect(staleWorker1.ok).toBe(false);
    if (!staleWorker1.ok) expect(staleWorker1.error.code).toBe('LEASE_HELD');

    const wrongVersion = await transitionConvergenceCasD1(d1, {
      jobId: 'job_lease_1', workspaceId: 'ws_alpha', expectedVersion: 2, leaseToken: 'lease_worker_2', nowMs: 7500,
      lifecycleStage: 'niche_video_plan',
    });
    expect(wrongVersion.ok).toBe(false);
    if (!wrongVersion.ok) expect(wrongVersion.error.code).toBe('CAS_VERSION_CONFLICT');
  });

  it('T04 & T08 & T09: rejects illegal stage regression and blocks any mutation or lease acquisition on terminal converged/rejected/cancelled jobs', async () => {
    await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_term_1', workspaceId: 'ws_alpha', userId: 'u_alpha', idempotencyKey: 'idem_term_1', nowMs: 1000,
    });
    const leased = await acquireConvergenceLeaseD1(d1, 'job_term_1', 'ws_alpha', 'token_1', 60000, 1100);
    expect(leased.ok).toBe(true);
    if (!leased.ok) return;

    const advanced = await transitionConvergenceCasD1(d1, {
      jobId: 'job_term_1', workspaceId: 'ws_alpha', expectedVersion: leased.value.version, leaseToken: 'token_1', nowMs: 1200,
      lifecycleStage: 'visual_storyboard',
    });
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;

    const regressed = await transitionConvergenceCasD1(d1, {
      jobId: 'job_term_1', workspaceId: 'ws_alpha', expectedVersion: advanced.value.version, leaseToken: 'token_1', nowMs: 1300,
      lifecycleStage: 'niche_video_plan',
    });
    expect(regressed.ok).toBe(false);
    if (!regressed.ok) expect(regressed.error.code).toBe('INVALID_STAGE_TRANSITION');

    const converged = await transitionConvergenceCasD1(d1, {
      jobId: 'job_term_1', workspaceId: 'ws_alpha', expectedVersion: advanced.value.version, leaseToken: 'token_1', nowMs: 1400,
      lifecycleStage: 'converged_terminal',
      verificationReport: { hasVerifiedMedia: true, checkedCount: 1, passedCount: 1, checksumMatched: true, durationValid: true },
      axes: { executionOutcome: 'succeeded', verificationOutcome: 'verified', deliveryOutcome: 'confirmed', businessOutcome: 'accepted' },
    });
    expect(converged.ok).toBe(true);
    if (!converged.ok) return;

    const lateOverwrite = await transitionConvergenceCasD1(d1, {
      jobId: 'job_term_1', workspaceId: 'ws_alpha', expectedVersion: converged.value.version, leaseToken: 'token_1', nowMs: 1500,
      lifecycleStage: 'converged_terminal', axes: { deliveryOutcome: 'failed' },
    });
    expect(lateOverwrite.ok).toBe(false);
    if (!lateOverwrite.ok) expect(lateOverwrite.error.code).toBe('TERMINAL_STATE_IMMUTABLE');

    const reLease = await acquireConvergenceLeaseD1(d1, 'job_term_1', 'ws_alpha', 'token_2', 60000, 99999);
    expect(reLease.ok).toBe(false);
    if (!reLease.ok) expect(reLease.error.code).toBe('TERMINAL_STATE_IMMUTABLE');
  });

  it('T11 & T12 & T13 & T19: enforces cross-workspace tenant isolation on job status, artifact retrieval, cancel, and CEO approval actions', async () => {
    await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_iso_1', workspaceId: 'ws_alpha', userId: 'u_alpha', idempotencyKey: 'idem_iso_1', nowMs: 1000,
    });
    const l = await acquireConvergenceLeaseD1(d1, 'job_iso_1', 'ws_alpha', 'tok_iso', 60000, 1100);
    if (!l.ok) return;
    await transitionConvergenceCasD1(d1, {
      jobId: 'job_iso_1', workspaceId: 'ws_alpha', expectedVersion: l.value.version, leaseToken: 'tok_iso', nowMs: 1200,
      lifecycleStage: 'ceo_approval_gate',
      artifactManifest: [{ artifactId: 'art_iso_plan', stageId: 'niche_video_plan', kind: 'plan', sha256: 'a'.repeat(64), sizeBytes: 128, uri: 'file:///tmp/plan.json', verified: true }],
    });

    const statusCross = await getConvergenceJobByIdD1(d1, 'job_iso_1', 'ws_beta');
    expect(statusCross.ok).toBe(false);
    if (!statusCross.ok) expect(statusCross.error.code).toBe('TENANT_MISMATCH');

    const artCross = await getConvergenceArtifactByIdD1(d1, 'job_iso_1', 'ws_beta', 'art_iso_plan');
    expect(artCross.ok).toBe(false);
    if (!artCross.ok) expect(artCross.error.code).toBe('TENANT_MISMATCH');

    const cancelCross = await cancelConvergenceJobD1(d1, 'job_iso_1', 'ws_beta');
    expect(cancelCross.ok).toBe(false);
    if (!cancelCross.ok) expect(cancelCross.error.code).toBe('TENANT_MISMATCH');

    const approveCross = await decideConvergenceApprovalD1(d1, 'job_iso_1', 'ws_beta', 'reject');
    expect(approveCross.ok).toBe(false);
    if (!approveCross.ok) expect(approveCross.error.code).toBe('TENANT_MISMATCH');

    const approveSame = await decideConvergenceApprovalD1(d1, 'job_iso_1', 'ws_alpha', 'reject');
    expect(approveSame.ok).toBe(true);
    if (approveSame.ok) expect(approveSame.value.businessOutcome).toBe('rejected');
  });
});
