import { describe, it, expect } from 'vitest';
import {
  ConvergenceLedgerRepo,
  canAdvanceStage,
  evaluateConvergedTruth,
  projectMissionAndAffiliateToAxes,
} from '@/tree/convergence';
import { runCreativeJobVerticalSlice } from '@/forest/convergence/creative-job-pipeline';

describe('Adversarial Convergence Matrix S01–S10 (Lifecycle, 4-Axis Truth & CAS Durability)', () => {
  it('S01: rejects fake-green completion when execution succeeded but media verification failed', () => {
    const repo = new ConvergenceLedgerRepo();
    const res = runCreativeJobVerticalSlice(repo, {
      jobId: 'job_s01', workspaceId: 'ws_alpha', userId: 'u_1',
      idempotencyKey: 'idem_s01', goal: 'Render corrupt video', simulateCorruptMedia: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.record.executionOutcome).toBe('succeeded');
    expect(res.value.record.verificationOutcome).toBe('failed');
    expect(res.value.truthState.isTrulyComplete).toBe(false);
    expect(res.value.truthState.isFakeGreenBlocked).toBe(true);
    expect(res.value.truthState.overallStatus).toBe('blocked_verification');
  });

  it('S02: blocks completion when business outcome is rejected by CEO', () => {
    const repo = new ConvergenceLedgerRepo();
    const res = runCreativeJobVerticalSlice(repo, {
      jobId: 'job_s02', workspaceId: 'ws_alpha', userId: 'u_1',
      idempotencyKey: 'idem_s02', goal: 'CEO reject test', ceoDecision: 'reject',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.record.businessOutcome).toBe('rejected');
    expect(res.value.truthState.isTrulyComplete).toBe(false);
    expect(res.value.truthState.overallStatus).toBe('failed');
  });

  it('S03: blocks completion when delivery fails despite verified media', () => {
    const repo = new ConvergenceLedgerRepo();
    const res = runCreativeJobVerticalSlice(repo, {
      jobId: 'job_s03', workspaceId: 'ws_alpha', userId: 'u_1',
      idempotencyKey: 'idem_s03', goal: 'Delivery fail test', simulateDeliveryFailure: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.record.verificationOutcome).toBe('verified');
    expect(res.value.record.deliveryOutcome).toBe('failed');
    expect(res.value.truthState.isTrulyComplete).toBe(false);
    expect(res.value.truthState.isFakeGreenBlocked).toBe(true);
    expect(res.value.truthState.overallStatus).toBe('blocked_business');
  });

  it('S04: converges all 4 outcome axes on happy path 12-stage vertical slice', () => {
    const repo = new ConvergenceLedgerRepo();
    const res = runCreativeJobVerticalSlice(repo, {
      jobId: 'job_s04', workspaceId: 'ws_alpha', userId: 'u_1',
      idempotencyKey: 'idem_s04', goal: 'Full 12-stage convergence',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.truthState.isTrulyComplete).toBe(true);
    expect(res.value.truthState.overallStatus).toBe('converged');
    expect(res.value.record.artifactManifest.length).toBe(5);
  });

  it('S05: deduplicates idempotent replay without re-running or double-charging', () => {
    const repo = new ConvergenceLedgerRepo();
    const first = runCreativeJobVerticalSlice(repo, {
      jobId: 'job_s05_a', workspaceId: 'ws_alpha', userId: 'u_1',
      idempotencyKey: 'idem_s05', goal: 'First run',
    });
    const replay = runCreativeJobVerticalSlice(repo, {
      jobId: 'job_s05_b', workspaceId: 'ws_alpha', userId: 'u_1',
      idempotencyKey: 'idem_s05', goal: 'Replay run',
    });
    expect(first.ok && replay.ok).toBe(true);
    if (!first.ok || !replay.ok) return;
    expect(replay.value.deduplicated).toBe(true);
    expect(replay.value.record.jobId).toBe('job_s05_a');
    expect(repo.listByWorkspace('ws_alpha').length).toBe(1);
  });

  it('S06: rejects CAS transition when expectedVersion is stale', () => {
    const repo = new ConvergenceLedgerRepo();
    repo.createOrGetIdempotent({ jobId: 'job_s06', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_s06' });
    repo.acquireLease('job_s06', 'ws_alpha', 'lease_1', 30000, 1000);
    const stale = repo.transitionCas({
      jobId: 'job_s06', workspaceId: 'ws_alpha', expectedVersion: 1, leaseToken: 'lease_1', lifecycleStage: 'niche_video_plan',
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('CAS_VERSION_CONFLICT');
  });

  it('S07: blocks competing worker lease while active lease has not expired', () => {
    const repo = new ConvergenceLedgerRepo();
    repo.createOrGetIdempotent({ jobId: 'job_s07', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_s07' });
    repo.acquireLease('job_s07', 'ws_alpha', 'worker_a', 10000, 1000);
    const contender = repo.acquireLease('job_s07', 'ws_alpha', 'worker_b', 10000, 5000);
    expect(contender.ok).toBe(false);
    if (!contender.ok) expect(contender.error.code).toBe('LEASE_HELD');
  });

  it('S08: permits lease takeover after TTL expiration and blocks un-leased CAS on expired lease', () => {
    const repo = new ConvergenceLedgerRepo();
    repo.createOrGetIdempotent({ jobId: 'job_s08', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_s08' });
    repo.acquireLease('job_s08', 'ws_alpha', 'worker_a', 10000, 1000);
    const expiredCas = repo.transitionCas({ jobId: 'job_s08', workspaceId: 'ws_alpha', expectedVersion: 2, leaseToken: 'worker_b', nowMs: 12000 });
    expect(expiredCas.ok).toBe(false);
    const recovered = repo.acquireLease('job_s08', 'ws_alpha', 'worker_b', 10000, 12000);
    expect(recovered.ok).toBe(true);
  });

  it('S09: rejects backwards stage transition unless entering crash_quarantine_recovery', () => {
    expect(canAdvanceStage('media_render_dispatch', 'script_synthesis')).toBe(false);
    expect(canAdvanceStage('media_render_dispatch', 'crash_quarantine_recovery')).toBe(true);
    expect(canAdvanceStage('crash_quarantine_recovery', 'ceo_approval_gate')).toBe(true);
  });

  it('S10: projects legacy Creative Mission + Affiliate Execution states onto 4 axes without fake green', () => {
    const axes = projectMissionAndAffiliateToAxes({
      missionStatus: 'completed', affiliateRunStatus: 'SUCCEEDED', hasVerifiedMedia: false, deliveryConfirmed: true, ceoApproved: true,
    });
    const truth = evaluateConvergedTruth(axes, false, false);
    expect(truth.isTrulyComplete).toBe(false);
    expect(truth.isFakeGreenBlocked).toBe(true);
  });
});
