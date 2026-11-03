/**
 * D1-Backed 12-Stage Creative Job Runner & 10-Window Crash Recovery Engine (Supreme #02.1 P2/P3 & #02.2 R2)
 * Layer: forest/convergence (imports seed and tree only — zero land imports)
 */

import type { D1Database } from '@/seed/db/client';
import { failure, type Result } from '@/seed/types/result';
import {
  acquireConvergenceLeaseD1,
  createOrGetConvergenceJobD1,
  transitionConvergenceCasD1,
  type ArtifactManifestEntry,
} from '@/tree/convergence';
import { MekongContractClient } from '@/tree/mekong';
import type { CreativeJobSliceOutput, RunCreativeJobSliceInput } from './creative-job-pipeline';
import { CREATIVE_JOB_12_STAGES, verifyMediaArtifactManifest } from './creative-job-stages';
import {
  applyMidPipelineCrashWindowD1,
  buildOrMaterializeStageArtifact,
  finalizeD1Slice,
  isMidPipelineCrashWindow,
} from './creative-job-d1-helpers';

export type CrashWindowId =
  | 'W01_AFTER_INTAKE_BEFORE_LEASE'
  | 'W02_AFTER_LEASE_BEFORE_MEKONG'
  | 'W03_AFTER_MEKONG_BEFORE_RECORD'
  | 'W04_DURING_RENDER_BEFORE_ARTIFACT'
  | 'W05_AFTER_ARTIFACT_BEFORE_VERIFICATION'
  | 'W06_AFTER_VERIFICATION_BEFORE_DELIVERY'
  | 'W07_AFTER_EXTERNAL_PUBLISH_BEFORE_RECEIPT'
  | 'W08_AFTER_DELIVERY_BEFORE_COST'
  | 'W09_DURING_RETRY_SCHEDULING'
  | 'W10_AFTER_LEASE_EXPIRY_DURING_LATE_CALLBACK';

export interface RunCreativeJobD1Input extends RunCreativeJobSliceInput {
  simulateCrashWindow?: CrashWindowId;
  leaseTokenOverride?: string;
  leaseDurationMs?: number;
  nowMs?: number;
}

export async function runCreativeJobVerticalSliceD1(
  d1: D1Database,
  input: RunCreativeJobD1Input
): Promise<Result<CreativeJobSliceOutput, { code: string; message: string }>> {
  const client = new MekongContractClient({
    mode: input.contractMode ?? 'DISABLED',
    d1,
    sqliteDbPath: input.sqliteDbPath,
    worktreeRootDir: input.worktreeRootDir,
  });
  const created = await createOrGetConvergenceJobD1(d1, {
    jobId: input.jobId, workspaceId: input.workspaceId, userId: input.userId,
    idempotencyKey: input.idempotencyKey, executionMode: client.getExecutionModeBadge(),
    estimatedCostUsd: 0.77, costStatus: input.costStatus, retryBudget: input.retryBudget, nowMs: input.nowMs,
  });
  if (!created.ok) return failure(created.error);
  const existing = created.value.record;
  if (created.value.deduplicated && existing.lifecycleStage === 'converged_terminal') {
    return finalizeD1Slice(d1, existing, existing.mekongJobId, true);
  }
  if (input.simulateCrashWindow === 'W01_AFTER_INTAKE_BEFORE_LEASE') return finalizeD1Slice(d1, existing, existing.mekongJobId, false);

  const leaseToken = input.leaseTokenOverride ?? `lease_${input.jobId}_v${existing.version}`;
  const leased = await acquireConvergenceLeaseD1(d1, input.jobId, input.workspaceId, leaseToken, input.leaseDurationMs ?? 60000, input.nowMs);
  if (!leased.ok) return failure(leased.error);
  const cur = leased.value;
  if (input.simulateCrashWindow === 'W02_AFTER_LEASE_BEFORE_MEKONG') return finalizeD1Slice(d1, cur, cur.mekongJobId, false);

  const attemptNo = input.simulateCrashWindow === 'W09_DURING_RETRY_SCHEDULING' ? cur.attemptNo + 1 : cur.attemptNo;
  const sub = await client.submitTaskAsync(
    { source_id: 'sophia_creative_slice', event_id: input.idempotencyKey, goal: input.goal, workspace_id: input.workspaceId },
    attemptNo
  );
  if (!sub.ok) return failure(sub.error);
  const ticketId = sub.value.ticket.ticket_id;
  if (input.simulateCrashWindow === 'W03_AFTER_MEKONG_BEFORE_RECORD') return finalizeD1Slice(d1, cur, ticketId, false);

  const manifest: ArtifactManifestEntry[] = [...cur.artifactManifest];
  let actualCostUsd = 0;
  for (const st of CREATIVE_JOB_12_STAGES) {
    if (st.stageId === 'crash_quarantine_recovery') continue;
    actualCostUsd += st.costUsd;
    if (st.producesArtifactKind && !manifest.some((m) => m.stageId === st.stageId)) {
      manifest.push(buildOrMaterializeStageArtifact(input, st.stageId, st.producesArtifactKind));
    }
    if (st.stageId === 'ceo_approval_gate' && input.ceoDecision === 'reject') {
      const rej = await transitionConvergenceCasD1(d1, {
        jobId: cur.jobId, workspaceId: cur.workspaceId, expectedVersion: cur.version, leaseToken, nowMs: input.nowMs,
        lifecycleStage: 'ceo_approval_gate', mekongJobId: ticketId, actualCostUsd, artifactManifest: manifest,
        axes: { executionOutcome: 'cancelled', businessOutcome: 'rejected' },
      });
      return rej.ok ? finalizeD1Slice(d1, rej.value, ticketId, false) : failure(rej.error);
    }
  }
  const verificationReport = verifyMediaArtifactManifest(manifest, `verif_${input.jobId}_att${attemptNo}`);
  if (input.simulateCrashWindow && isMidPipelineCrashWindow(input.simulateCrashWindow)) {
    const partial = await applyMidPipelineCrashWindowD1(d1, cur, leaseToken, ticketId, input.simulateCrashWindow, manifest, verificationReport, input.nowMs);
    return partial.ok ? finalizeD1Slice(d1, partial.value, ticketId, false) : failure(partial.error);
  }
  const fin = await transitionConvergenceCasD1(d1, {
    jobId: cur.jobId, workspaceId: cur.workspaceId, expectedVersion: cur.version, leaseToken,
    lifecycleStage: 'converged_terminal', mekongJobId: ticketId, actualCostUsd, attemptNo, nowMs: input.nowMs,
    costStatus: input.costStatus, retryBudget: input.retryBudget, artifactManifest: manifest, verificationReport,
    axes: {
      executionOutcome: 'succeeded', verificationOutcome: verificationReport.hasVerifiedMedia ? 'verified' : 'failed',
      deliveryOutcome: input.simulateDeliveryFailure ? 'failed' : 'confirmed',
      businessOutcome: input.ceoDecision === 'hold' ? 'human_review_required' : 'accepted',
    },
  });
  return fin.ok ? finalizeD1Slice(d1, fin.value, ticketId, false) : failure(fin.error);
}
