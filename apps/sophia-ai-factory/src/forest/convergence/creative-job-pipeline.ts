/**
 * 12-Stage Creative Job End-to-End Convergence Pipeline (Gate S5, Gate S6, Gate S8)
 * Layer: forest/convergence (imports seed and tree only — zero land imports)
 */

import { success, failure, type Result } from '@/seed/types/result';
import {
  ConvergenceLedgerRepo, calculateUnitEconomics, evaluateConvergedTruth,
  type ArtifactManifestEntry, type ConvergenceLedgerRecord, type ConvergedTruthState, type UnitEconomicsSummary,
} from '@/tree/convergence';
import {
  MekongContractClient, evaluateCrashRetryGate, inspectAndPreserveCrashedAttempt, type MekongContractMode,
} from '@/tree/mekong';
import { CREATIVE_JOB_12_STAGES, buildDeterministicStageArtifact, verifyMediaArtifactManifest } from './creative-job-stages';

export interface RunCreativeJobSliceInput {
  jobId: string; workspaceId: string; userId: string; idempotencyKey: string; goal: string;
  contractMode?: MekongContractMode; sqliteDbPath?: string; worktreeRootDir?: string;
  ceoDecision?: 'approve' | 'reject' | 'hold';
  simulateCorruptMedia?: boolean; simulateDeliveryFailure?: boolean;
  simulateCrashOnAttempt1?: { crashedWorktreeDir: string; quarantineRootDir: string; sideEffectUncertain: boolean };
}

export interface CreativeJobSliceOutput {
  record: ConvergenceLedgerRecord; truthState: ConvergedTruthState;
  unitEconomics: UnitEconomicsSummary; mekongTicketId: string | null; deduplicated: boolean;
}

function finalizeSliceOutput(
  repo: ConvergenceLedgerRepo, rec: ConvergenceLedgerRecord, mekongTicketId: string | null, deduplicated: boolean
): Result<CreativeJobSliceOutput, { code: string; message: string }> {
  return success({
    record: rec,
    truthState: evaluateConvergedTruth(rec, rec.sideEffectUncertain, rec.verificationReport.hasVerifiedMedia),
    unitEconomics: calculateUnitEconomics(repo.listByWorkspace(rec.workspaceId)),
    mekongTicketId,
    deduplicated,
  });
}

export function runCreativeJobVerticalSlice(
  repo: ConvergenceLedgerRepo, input: RunCreativeJobSliceInput
): Result<CreativeJobSliceOutput, { code: string; message: string }> {
  const client = new MekongContractClient({
    mode: input.contractMode ?? 'DISABLED', sqliteDbPath: input.sqliteDbPath, worktreeRootDir: input.worktreeRootDir,
  });
  const created = repo.createOrGetIdempotent({
    jobId: input.jobId, workspaceId: input.workspaceId, userId: input.userId,
    idempotencyKey: input.idempotencyKey, executionMode: client.getExecutionModeBadge(), estimatedCostUsd: 0.77,
  });
  if (!created.ok) return failure(created.error);
  if (created.value.deduplicated) return finalizeSliceOutput(repo, created.value.record, created.value.record.mekongJobId, true);

  const leaseToken = `lease_${input.jobId}`;
  const leased = repo.acquireLease(input.jobId, input.workspaceId, leaseToken, 60000);
  if (!leased.ok) return failure(leased.error);
  const current = leased.value;
  const manifest: ArtifactManifestEntry[] = [];
  let actualCostUsd = 0;
  let retryCostUsd = 0;

  if (input.simulateCrashOnAttempt1) {
    const preserved = inspectAndPreserveCrashedAttempt({
      crashedWorktreeDir: input.simulateCrashOnAttempt1.crashedWorktreeDir,
      quarantineRootDir: input.simulateCrashOnAttempt1.quarantineRootDir,
      baseTaskId: input.idempotencyKey, crashedAttemptNo: 1,
    });
    const gate = evaluateCrashRetryGate({
      baseTaskId: input.idempotencyKey, crashedAttemptNo: 1,
      sideEffectUncertain: input.simulateCrashOnAttempt1.sideEffectUncertain, preservedPath: preserved.preservedPath,
    });
    retryCostUsd = 0.15;
    if (!gate.allowAutoRetry) {
      const quarantined = repo.transitionCas({
        jobId: current.jobId, workspaceId: current.workspaceId, expectedVersion: current.version, leaseToken,
        lifecycleStage: 'crash_quarantine_recovery', sideEffectUncertain: true, crashPreservedPath: preserved.preservedPath,
        retryCostUsd, axes: { executionOutcome: 'crashed', businessOutcome: 'human_review_required' },
      });
      return quarantined.ok ? finalizeSliceOutput(repo, quarantined.value, null, false) : failure(quarantined.error);
    }
  }

  const submitRes = client.submitTask({
    source_id: 'sophia_creative_slice', event_id: input.idempotencyKey, goal: input.goal, workspace_id: input.workspaceId,
  }, input.simulateCrashOnAttempt1 ? 2 : 1);
  if (!submitRes.ok) return failure(submitRes.error);
  const ticketId = submitRes.value.ticket.ticket_id;

  for (const st of CREATIVE_JOB_12_STAGES) {
    if (st.stageId === 'crash_quarantine_recovery') continue;
    actualCostUsd += st.costUsd;
    if (st.producesArtifactKind) {
      manifest.push(buildDeterministicStageArtifact(input.jobId, st.stageId, st.producesArtifactKind, input.simulateCorruptMedia));
    }
    if (st.stageId === 'ceo_approval_gate' && input.ceoDecision === 'reject') {
      const rej = repo.transitionCas({
        jobId: current.jobId, workspaceId: current.workspaceId, expectedVersion: current.version, leaseToken,
        lifecycleStage: 'ceo_approval_gate', mekongJobId: ticketId, actualCostUsd, retryCostUsd, artifactManifest: manifest,
        axes: { executionOutcome: 'cancelled', businessOutcome: 'rejected' },
      });
      return rej.ok ? finalizeSliceOutput(repo, rej.value, ticketId, false) : failure(rej.error);
    }
  }

  const verificationReport = verifyMediaArtifactManifest(manifest);
  const finalStep = repo.transitionCas({
    jobId: current.jobId, workspaceId: current.workspaceId, expectedVersion: current.version, leaseToken,
    lifecycleStage: 'converged_terminal', mekongJobId: ticketId, actualCostUsd, retryCostUsd,
    attemptNo: input.simulateCrashOnAttempt1 ? 2 : 1, artifactManifest: manifest, verificationReport,
    axes: {
      executionOutcome: 'succeeded',
      verificationOutcome: verificationReport.hasVerifiedMedia ? 'verified' : 'failed',
      deliveryOutcome: input.simulateDeliveryFailure ? 'failed' : 'confirmed',
      businessOutcome: input.ceoDecision === 'hold' ? 'human_review_required' : 'accepted',
    },
  });
  return finalStep.ok ? finalizeSliceOutput(repo, finalStep.value, ticketId, false) : failure(finalStep.error);
}
