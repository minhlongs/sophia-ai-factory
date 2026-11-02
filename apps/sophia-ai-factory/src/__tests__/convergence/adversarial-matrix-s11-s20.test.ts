import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  MEKONG_CONTRACT_OPERATIONS, MEKONG_CONTRACT_VERSION, MekongContractClient,
  buildAttemptScopedTaskId, evaluateCrashRetryGate, inspectAndPreserveCrashedAttempt, validateOutcomeEnvelope,
} from '@/tree/mekong';
import { ConvergenceLedgerRepo, describeExecutionBadge } from '@/tree/convergence';
import { runCreativeJobVerticalSlice } from '@/forest/convergence/creative-job-pipeline';

describe('Adversarial Convergence Matrix S11–S20 (Mekong Contract v1 & SIGKILL Crash Guard)', () => {
  it('S11: supports all 10 canonical operations in deterministic contract client mode', () => {
    expect(MEKONG_CONTRACT_OPERATIONS.length).toBe(10);
    const client = new MekongContractClient({ mode: 'ENABLED' });
    const sub = client.submitTask({ source_id: 'sophia', event_id: 'ev_s11', goal: 'Test 10 ops', workspace_id: 'ws_1' });
    expect(sub.ok).toBe(true);
    if (!sub.ok) return;
    const tid = sub.value.ticket.ticket_id;
    expect(client.getTicket(tid).ok && client.getStatus(tid).ok && client.getVerificationEvidence(tid).ok).toBe(true);
    expect(client.getArtifacts(tid).ok && client.listDurableReports(tid).ok && client.getCostUsage(tid).ok).toBe(true);
    expect(client.resumeReconcile(tid).ok && client.reportApprovalRequired(tid, 'audit').ok && client.requestCancel(tid, 'stop').ok).toBe(true);
  });

  it('S12: bridges to real Mekong SQLite runtime (`sophia_integration_v1.py`) in LOCAL_TEST mode', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-s12-'));
    const client = new MekongContractClient({ mode: 'LOCAL_TEST', sqliteDbPath: path.join(tmpDir, 'mekong_s12.db') });
    const sub = client.submitTask({ source_id: 'sophia_e2e', event_id: 'ev_s12', goal: 'Real SQLite bridge run', workspace_id: 'ws_s12' });
    expect(sub.ok).toBe(true);
    if (sub.ok) {
      expect(sub.value.contract_version).toBe(MEKONG_CONTRACT_VERSION);
      expect(client.getStatus(sub.value.ticket.ticket_id).ok).toBe(true);
      expect(client.getCostUsage(sub.value.ticket.ticket_id).ok).toBe(true);
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('S13: executes 12-stage Creative Job vertical slice end-to-end over real LOCAL_TEST SQLite bridge', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-s13-'));
    const repo = new ConvergenceLedgerRepo();
    const res = runCreativeJobVerticalSlice(repo, {
      jobId: 'job_s13', workspaceId: 'ws_s13', userId: 'u_s13',
      idempotencyKey: 'idem_s13', goal: '12-stage real bridge', contractMode: 'LOCAL_TEST', sqliteDbPath: path.join(tmpDir, 'mekong_s13.db'),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.truthState.isTrulyComplete).toBe(true);
      expect(res.value.record.executionMode).toBe('LOCAL_TEST');
      expect(res.value.mekongTicketId).toBeTruthy();
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('S14: rejects outcome envelope with mismatched contract_version', () => {
    const v = validateOutcomeEnvelope({
      contract_version: 'mekong.sophia.execution_contract.v0', ticket_id: 't1', goal_id: 'g1',
      truth_status: 'EXECUTED', simulated: false, execution_outcome: 'EXECUTED',
      verification_outcome: 'VERIFIED_SUCCESS', delivery_outcome: 'SENT', business_outcome: 'NOT_EVALUATED', verified_success_claim_permitted: false,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error.code).toBe('INVALID_CONTRACT_VERSION');
  });

  it('S15: rejects fake-green verified_success_claim_permitted when simulated=true', () => {
    const v = validateOutcomeEnvelope({
      contract_version: MEKONG_CONTRACT_VERSION, ticket_id: 't1', goal_id: 'g1',
      truth_status: 'VERIFIED_SUCCESS', simulated: true, execution_outcome: 'EXECUTED',
      verification_outcome: 'VERIFIED_SUCCESS', delivery_outcome: 'SENT', business_outcome: 'NOT_EVALUATED', verified_success_claim_permitted: true,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error.code).toBe('INVALID_OUTCOME_CLAIM');
  });

  it('S16: labels fallback execution badges honestly across DISABLED, SHADOW, LOCAL_TEST, ENABLED', () => {
    expect(describeExecutionBadge('LOCAL_DETERMINISTIC').isFallback).toBe(true);
    expect(describeExecutionBadge('SHADOW').isFallback).toBe(true);
    expect(describeExecutionBadge('CLOUD_FALLBACK').isFallback).toBe(true);
    expect(describeExecutionBadge('LOCAL_TEST').isFallback).toBe(false);
    expect(describeExecutionBadge('MEKONG_ENABLED').isFallback).toBe(false);
  });

  it('S17: caps attempt-scoped task IDs at <= 64 chars so WorktreeIsolationManager never truncates suffix', () => {
    const longBase = 'creative-mission-super-long-identifier-that-exceeds-sixty-four-characters-easily';
    const att1 = buildAttemptScopedTaskId(longBase, 1);
    const att2 = buildAttemptScopedTaskId(longBase, 2);
    expect(att1.length).toBeLessThanOrEqual(64);
    expect(att2.length).toBeLessThanOrEqual(64);
    expect(att1.endsWith('__att1') && att2.endsWith('__att2') && att1 !== att2).toBe(true);
  });

  it('S18: preserves uncommitted files from a SIGKILL-crashed attempt worktree before retry', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-s18-'));
    const crashedWt = path.join(tmpDir, 'wt_att1');
    fs.mkdirSync(path.join(crashedWt, 'scenes'), { recursive: true });
    fs.writeFileSync(path.join(crashedWt, 'scenes', 'partial-render.mp4'), 'UNCOMMITTED_BYTES');
    const preserved = inspectAndPreserveCrashedAttempt({
      crashedWorktreeDir: crashedWt, quarantineRootDir: path.join(tmpDir, 'quarantine'), baseTaskId: 'task_s18', crashedAttemptNo: 1,
    });
    expect(preserved.harvestedFromWorktree).toBe(true);
    expect(preserved.preservedFiles).toContain('scenes/partial-render.mp4');
    expect(fs.existsSync(path.join(preserved.preservedPath!, 'scenes', 'partial-render.mp4'))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('S19: locks pipeline into HUMAN_REVIEW_REQUIRED when sideEffectUncertain=true after crash', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-s19-'));
    const crashedWt = path.join(tmpDir, 'wt_att1');
    fs.mkdirSync(crashedWt, { recursive: true });
    fs.writeFileSync(path.join(crashedWt, 'draft.json'), '{"partial":true}');
    const repo = new ConvergenceLedgerRepo();
    const res = runCreativeJobVerticalSlice(repo, {
      jobId: 'job_s19', workspaceId: 'ws_s19', userId: 'u_s19', idempotencyKey: 'idem_s19', goal: 'Crash quarantine test',
      simulateCrashOnAttempt1: { crashedWorktreeDir: crashedWt, quarantineRootDir: path.join(tmpDir, 'q'), sideEffectUncertain: true },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.truthState.overallStatus).toBe('human_review_required');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('S20: permits automatic retry on isolated attempt key __att2 when sideEffectUncertain=false', () => {
    const gate = evaluateCrashRetryGate({ baseTaskId: 'task_s20', crashedAttemptNo: 1, sideEffectUncertain: false });
    expect(gate.allowAutoRetry).toBe(true);
    expect(gate.nextScopedTaskId).toBe('task_s20__att2');
  });
});
