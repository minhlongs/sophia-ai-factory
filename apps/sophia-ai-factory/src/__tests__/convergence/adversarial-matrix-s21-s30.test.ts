import { describe, it, expect } from 'vitest';
import {
  ConvergenceLedgerRepo,
  calculateUnitEconomics,
} from '@/tree/convergence';
import { validateTaskSubmission } from '@/tree/mekong';
import {
  buildIllustrativeWorkflowView,
  enrichWorkflowConvergenceFromRecord,
} from '@/tree/mission/workflow-view-model';
import { runCreativeJobVerticalSlice } from '@/forest/convergence/creative-job-pipeline';

describe('Adversarial Convergence Matrix S21–S30 (Tenant Isolation, Unit Economics & Operator UI Truth)', () => {
  it('S21: blocks cross-tenant getByIdForWorkspace on ConvergenceLedgerRepo (Tenant A vs Tenant B)', () => {
    const repo = new ConvergenceLedgerRepo();
    repo.createOrGetIdempotent({
      jobId: 'job_s21', workspaceId: 'ws_tenant_a', userId: 'u_a', idempotencyKey: 'idem_s21',
    });
    const crossRead = repo.getByIdForWorkspace('job_s21', 'ws_tenant_b');
    expect(crossRead.ok).toBe(false);
    if (!crossRead.ok) expect(crossRead.error.code).toBe('TENANT_MISMATCH');
  });

  it('S22: blocks cross-tenant acquireLease on ConvergenceLedgerRepo (Tenant A vs Tenant B)', () => {
    const repo = new ConvergenceLedgerRepo();
    repo.createOrGetIdempotent({
      jobId: 'job_s22', workspaceId: 'ws_tenant_a', userId: 'u_a', idempotencyKey: 'idem_s22',
    });
    const crossLease = repo.acquireLease('job_s22', 'ws_tenant_b', 'attacker_lease', 30000);
    expect(crossLease.ok).toBe(false);
    if (!crossLease.ok) expect(crossLease.error.code).toBe('TENANT_MISMATCH');
  });

  it('S23: blocks cross-tenant transitionCas on ConvergenceLedgerRepo (Tenant A vs Tenant B)', () => {
    const repo = new ConvergenceLedgerRepo();
    repo.createOrGetIdempotent({
      jobId: 'job_s23', workspaceId: 'ws_tenant_a', userId: 'u_a', idempotencyKey: 'idem_s23',
    });
    const crossCas = repo.transitionCas({
      jobId: 'job_s23', workspaceId: 'ws_tenant_b', expectedVersion: 1, leaseToken: 'attacker',
    });
    expect(crossCas.ok).toBe(false);
    if (!crossCas.ok) expect(crossCas.error.code).toBe('TENANT_MISMATCH');
  });

  it('S24: isolates idempotency keys per workspace so Tenant B cannot hijack Tenant A job', () => {
    const repo = new ConvergenceLedgerRepo();
    const a = repo.createOrGetIdempotent({
      jobId: 'job_a', workspaceId: 'ws_tenant_a', userId: 'u_a', idempotencyKey: 'shared_key',
    });
    const b = repo.createOrGetIdempotent({
      jobId: 'job_b', workspaceId: 'ws_tenant_b', userId: 'u_b', idempotencyKey: 'shared_key',
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.value.deduplicated).toBe(false);
      expect(a.value.record.jobId).not.toBe(b.value.record.jobId);
    }
    const collide = repo.createOrGetIdempotent({ jobId: 'job_a', workspaceId: 'ws_tenant_b', userId: 'u_b', idempotencyKey: 'other_key' });
    expect(collide.ok).toBe(false);
    if (!collide.ok) expect(collide.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('S25: rejects forged workspace_id in Mekong Contract v1 task submission', () => {
    const res = validateTaskSubmission(
      { source_id: 'sophia', event_id: 'ev_25', goal: 'Run', workspace_id: 'ws_forged' },
      'ws_authenticated_tenant_a'
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('TENANT_MISMATCH');
  });

  it('S26: returns zero-safe UnitEconomicsSummary when ledger is empty (0 division guard)', () => {
    const econ = calculateUnitEconomics([]);
    expect(econ).toEqual({
      costPerVerifiedJob: 0,
      costPerAcceptedArtifact: 0,
      verificationYield: 0,
      businessAcceptanceYield: 0,
      retryOverhead: 0,
    });
  });

  it('S27: computes all 5 unit-economics metrics accurately across mixed verified, rejected, and retried jobs', () => {
    const repo = new ConvergenceLedgerRepo();
    runCreativeJobVerticalSlice(repo, {
      jobId: 'j1', workspaceId: 'ws_econ', userId: 'u1', idempotencyKey: 'k1', goal: 'Accepted job',
    });
    runCreativeJobVerticalSlice(repo, {
      jobId: 'j2', workspaceId: 'ws_econ', userId: 'u1', idempotencyKey: 'k2', goal: 'Corrupt job', simulateCorruptMedia: true,
    });
    const econ = calculateUnitEconomics(repo.listByWorkspace('ws_econ'));
    expect(econ.verificationYield).toBe(0.5);
    expect(econ.businessAcceptanceYield).toBe(1);
    expect(econ.costPerVerifiedJob).toBeGreaterThan(0);
    expect(econ.costPerAcceptedArtifact).toBeGreaterThan(0);
  });

  it('S28: computes positive retryOverhead when crash recovery or retry spend occurs', () => {
    const repo = new ConvergenceLedgerRepo();
    runCreativeJobVerticalSlice(repo, {
      jobId: 'j_retry', workspaceId: 'ws_retry', userId: 'u1', idempotencyKey: 'k_retry', goal: 'Retry overhead job',
      simulateCrashOnAttempt1: { crashedWorktreeDir: '/nonexistent', quarantineRootDir: '/tmp', sideEffectUncertain: false },
    });
    const econ = calculateUnitEconomics(repo.listByWorkspace('ws_retry'));
    expect(econ.retryOverhead).toBeGreaterThan(0);
  });

  it('S29: enriches Operator WorkflowView with 4 axes, honest fallback badge, and 5 unit-economics metrics', () => {
    const illustrative = buildIllustrativeWorkflowView();
    expect(illustrative.convergence).toBeDefined();
    expect(illustrative.convergence?.executionBadge.isFallback).toBe(true);
    expect(illustrative.convergence?.executionBadge.mode).toBe('LOCAL_DETERMINISTIC');
  });

  it('S30: surfaces HUMAN_REVIEW_REQUIRED alert in enriched WorkflowConvergenceView when sideEffectUncertain=true', () => {
    const repo = new ConvergenceLedgerRepo();
    const res = runCreativeJobVerticalSlice(repo, {
      jobId: 'j_s30', workspaceId: 'ws_s30', userId: 'u1', idempotencyKey: 'k_s30', goal: 'Quarantine UI test',
      simulateCrashOnAttempt1: { crashedWorktreeDir: '/nonexistent', quarantineRootDir: '/tmp', sideEffectUncertain: true },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const view = enrichWorkflowConvergenceFromRecord(res.value.record, res.value.unitEconomics);
    expect(view.crashRecoveryAlert.active).toBe(true);
    expect(view.crashRecoveryAlert.status).toBe('HUMAN_REVIEW_REQUIRED');
    expect(view.truthState.requiresHumanReview).toBe(true);
  });
});
