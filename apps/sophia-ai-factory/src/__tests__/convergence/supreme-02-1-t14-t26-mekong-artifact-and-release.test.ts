/**
 * Supreme Command #02.1 Regression Suite — Part 2: T14 through T26
 *
 * Tests Mekong 10/10 operations in standalone SQLite fallback + checkout mode,
 * fail-closed runtime guard on `ENABLED` (`MEKONG_REAL_EXECUTION=NOT_VERIFIED`),
 * real local disk artifact materialization + SHA-256 tamper detection,
 * unit economics honesty (`unknown` model cost vs known cost), retry budget enforcement,
 * and release authorization guard (`T23`).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';
import {
  ConvergenceLedgerRepo,
  calculateUnitEconomics,
  evaluateConvergedTruth,
} from '@/tree/convergence';
import {
  MekongContractClient,
  getMekongContractCapabilityMatrix,
  type MekongContractOperation,
} from '@/tree/mekong';
import { runCreativeJobVerticalSliceD1 } from '@/forest/convergence/creative-job-d1-runner';
import { verifyDiskBackedArtifactManifest } from '@/forest/convergence/local-artifact-materializer';
import { evaluateReleaseAuthorization } from '../../../scripts/verify-release-authorization.mjs';

const MIGRATION_0494_SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'migrations/0494_authoritative_job_convergence_ledger.sql'),
  'utf8'
);

describe('Supreme Command #02.1 — T14..T26: Mekong 10/10 Ops, Disk Artifacts, Economics & Release Guard', () => {
  let d1: D1Database;
  let tmpDir: string;

  beforeEach(() => {
    const raw = freshDb();
    raw.exec(MIGRATION_0494_SQL);
    d1 = makeD1(raw) as unknown as D1Database;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-sup021-'));
  });

  it('T14 & T15 & T16: supports all 10 Mekong contract operations in standalone SQLite fallback mode, rejects unknown ops, and fails closed on unverified ENABLED runtime', () => {
    const sqlitePath = path.join(tmpDir, 'mekong-fallback.sqlite');
    const client = new MekongContractClient({
      mode: 'LOCAL_TEST',
      sqliteDbPath: sqlitePath,
      worktreeRootDir: path.join(tmpDir, 'wt'),
      mekongRepoRoot: path.join(tmpDir, 'nonexistent-mekong-repo'),
    });

    const sub = client.submitTask({
      source_id: 'sophia_t15', event_id: 'evt_t15_all_ops', goal: 'Test all 10 Mekong contract ops', workspace_id: 'ws_alpha',
    });
    expect(sub.ok).toBe(true);
    if (!sub.ok) return;
    const tid = sub.value.ticket.ticket_id;

    expect(client.getTicket(tid).ok).toBe(true);
    expect(client.getStatus(tid).ok).toBe(true);
    expect(client.getVerificationEvidence(tid).ok).toBe(true);
    expect(client.getArtifacts(tid).ok).toBe(true);
    expect(client.reportApprovalRequired(tid, 'ceo_hold').ok).toBe(true);
    expect(client.resumeReconcile(tid).ok).toBe(true);
    expect(client.listDurableReports(tid).ok).toBe(true);
    expect(client.getCostUsage(tid).ok).toBe(true);
    expect(client.requestCancel(tid, 'test_cancel').ok).toBe(true);

    const invalidOp = client.invokeOperation('non_existent_op' as MekongContractOperation, {});
    expect(invalidOp.ok).toBe(false);
    if (!invalidOp.ok) expect(invalidOp.error.code).toBe('UNSUPPORTED_OPERATION');

    const unverifiedEnabled = new MekongContractClient({ mode: 'ENABLED', requireVerifiedRealRuntime: true });
    const failClosed = unverifiedEnabled.submitTask({
      source_id: 'sophia_t16', event_id: 'evt_t16', goal: 'Should fail closed', workspace_id: 'ws_alpha',
    });
    expect(failClosed.ok).toBe(false);
    if (!failClosed.ok) expect(failClosed.error.code).toBe('RUNTIME_UNAVAILABLE');
    expect(getMekongContractCapabilityMatrix().length).toBe(10);
  });

  it('T17 & T18 & T24 & T25 & T26: materializes real local artifacts on disk, detects SHA-256 byte tampering, and enforces 4-axis convergence truth', async () => {
    const artifactRootDir = path.join(tmpDir, 'artifacts');
    const sliceRes = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_real_art_1',
      workspaceId: 'ws_alpha',
      userId: 'u_alpha',
      idempotencyKey: 'idem_real_art_1',
      goal: 'Create real bilingual product launch video',
      artifactRootDir,
    });
    expect(sliceRes.ok).toBe(true);
    if (!sliceRes.ok) return;

    expect(sliceRes.value.truthState.isTrulyComplete).toBe(true);
    expect(sliceRes.value.record.artifactManifest.length).toBe(5);
    const videoEntry = sliceRes.value.record.artifactManifest.find((a) => a.kind === 'video');
    expect(videoEntry?.localFilePath).toBeTruthy();
    if (!videoEntry?.localFilePath) return;
    expect(fs.existsSync(videoEntry.localFilePath)).toBe(true);
    const mp4Bytes = fs.readFileSync(videoEntry.localFilePath);
    expect(mp4Bytes.byteLength).toBeGreaterThan(64);
    expect(Buffer.from(mp4Bytes.subarray(4, 8)).toString('ascii')).toBe('ftyp');

    // Tamper with the rendered MP4 on disk and re-verify (T17)
    fs.writeFileSync(videoEntry.localFilePath, Buffer.from('CORRUPTED_MP4_STREAM'));
    const tamperedReport = verifyDiskBackedArtifactManifest(sliceRes.value.record.artifactManifest, 'verif_tampered');
    expect(tamperedReport.hasVerifiedMedia).toBe(false);
    expect(tamperedReport.checksumMatched).toBe(false);

    // T18: Delivery failure prevents converged truth even when execution & verification succeed
    const delivFail = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_deliv_fail_1',
      workspaceId: 'ws_alpha',
      userId: 'u_alpha',
      idempotencyKey: 'idem_deliv_fail_1',
      goal: 'Simulate channel delivery failure',
      artifactRootDir,
      simulateDeliveryFailure: true,
    });
    expect(delivFail.ok).toBe(true);
    if (delivFail.ok) {
      expect(delivFail.value.truthState.isTrulyComplete).toBe(false);
      expect(delivFail.value.truthState.overallStatus).toBe('blocked_business');
    }
  });

  it('T20 & T21 & T22: tracks measured vs unknown cost without fake $0.00 dilution and enforces retry budget limits', () => {
    const repo = new ConvergenceLedgerRepo();
    const c1 = repo.createOrGetIdempotent({
      jobId: 'job_econ_measured', workspaceId: 'ws_alpha', userId: 'u_alpha', idempotencyKey: 'idem_econ_1',
      estimatedCostUsd: 0.77, costStatus: 'measured', retryBudget: 2,
    });
    if (!c1.ok) return;
    const l1 = repo.acquireLease('job_econ_measured', 'ws_alpha', 'lease_econ_1', 60000);
    if (!l1.ok) return;
    repo.transitionCas({
      jobId: 'job_econ_measured', workspaceId: 'ws_alpha', expectedVersion: l1.value.version, leaseToken: 'lease_econ_1',
      lifecycleStage: 'converged_terminal', actualCostUsd: 0.77, retryCostUsd: 0.15, attemptNo: 2, costStatus: 'measured',
      verificationReport: { hasVerifiedMedia: true, checkedCount: 1, passedCount: 1, checksumMatched: true, durationValid: true },
      axes: { executionOutcome: 'succeeded', verificationOutcome: 'verified', deliveryOutcome: 'confirmed', businessOutcome: 'accepted' },
    });

    const c2 = repo.createOrGetIdempotent({
      jobId: 'job_econ_unknown', workspaceId: 'ws_alpha', userId: 'u_alpha', idempotencyKey: 'idem_econ_2',
      estimatedCostUsd: 0, costStatus: 'unknown', retryBudget: 1,
    });
    expect(c2.ok).toBe(true);
    if (!c2.ok) return;
    const l2 = repo.acquireLease('job_econ_unknown', 'ws_alpha', 'lease_econ_2', 60000);
    if (!l2.ok) return;

    // T22: Retry budget exceeded (attemptNo 2 > retryBudget 1)
    const overBudget = repo.transitionCas({
      jobId: 'job_econ_unknown', workspaceId: 'ws_alpha', expectedVersion: l2.value.version, leaseToken: 'lease_econ_2',
      attemptNo: 2,
    });
    expect(overBudget.ok).toBe(false);
    if (!overBudget.ok) expect(overBudget.error.code).toBe('RETRY_BUDGET_EXCEEDED');

    const summary = calculateUnitEconomics(repo.listByWorkspace('ws_alpha'));
    expect(summary.unknownCostJobsCount).toBe(1);
    expect(summary.costStatus).toBe('unknown');
    expect(summary.costPerVerifiedJob).toBe(0.92);
    expect(evaluateConvergedTruth(c2.value.record, false, false).isTrulyComplete).toBe(false);
  });

  it('T23: release authorization guard blocks unapproved auto-deploys and allows explicit release tags or dry-run', () => {
    const blocked = evaluateReleaseAuthorization({ DRY_RUN: 'false', COMMIT_MESSAGE: 'feat: ordinary merge commit' });
    expect(blocked.authorized).toBe(false);
    expect(blocked.mode).toBe('BLOCKED_UNAUTHORIZED_AUTO_DEPLOY');

    const readOnlyBlocked = evaluateReleaseAuthorization({
      SOPHIA_PRODUCTION_READ_ONLY: '1',
      AUTHORIZE_PRODUCTION_RELEASE: 'true',
    });
    expect(readOnlyBlocked.authorized).toBe(false);

    const tagAllowed = evaluateReleaseAuthorization({
      COMMIT_MESSAGE: 'feat(release): ship v1.2 [RELEASE-AUTHORIZED]',
    });
    expect(tagAllowed.authorized).toBe(true);
    expect(tagAllowed.mode).toBe('COMMIT_TAG_APPROVED');

    const dryRunAllowed = evaluateReleaseAuthorization({ DRY_RUN: 'true' });
    expect(dryRunAllowed.authorized).toBe(true);
    expect(dryRunAllowed.mode).toBe('DRY_RUN_ONLY');
  });
});
