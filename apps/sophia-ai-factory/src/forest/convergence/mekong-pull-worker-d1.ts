/**
 * External Mekong Pull-Worker D1 Coordinator (`claim_next_job` & `complete_worker_attempt`) (Supreme #02.2 R3)
 * Enforces D1 Lease acquisition, CAS version transitions, attempt-scoped idempotency,
 * media integrity verification (`verifyMediaArtifactManifest`), and 4-axis convergence.
 * Layer: forest/convergence (imports seed and tree only)
 */

import type { D1Database } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import {
  acquireConvergenceLeaseD1, getConvergenceJobByIdD1, isTerminalConvergenceState,
  listConvergenceJobsByWorkspaceD1, transitionConvergenceCasD1,
  type ArtifactManifestEntry, type BusinessOutcome, type ConvergenceError,
  type ConvergenceLedgerRecord, type DeliveryOutcome, type ExecutionOutcome,
} from '@/tree/convergence';
import { MekongContractClient } from '@/tree/mekong';
import type { CreativeJobSliceOutput } from './creative-job-pipeline';
import { CREATIVE_JOB_12_STAGES, buildDeterministicStageArtifact, verifyMediaArtifactManifest } from './creative-job-stages';
import { finalizeD1Slice } from './creative-job-d1-helpers';

export interface ClaimNextConvergenceJobInput {
  workspaceId: string; workerId: string; jobId?: string; leaseToken?: string; leaseDurationMs?: number; nowMs?: number;
}
export interface ClaimNextConvergenceJobOutput {
  claimed: boolean; record: ConvergenceLedgerRecord | null; leaseToken: string | null; mekongTicketId: string | null;
}
export interface CompleteWorkerAttemptInput {
  jobId: string; workspaceId: string; workerId: string; leaseToken: string; expectedVersion: number;
  attemptNo?: number; executionOutcome?: ExecutionOutcome; deliveryOutcome?: DeliveryOutcome;
  businessOutcome?: BusinessOutcome; actualCostUsd?: number; artifactManifest?: ArtifactManifestEntry[];
  simulateCorruptMedia?: boolean; nowMs?: number;
}

export async function claimNextConvergenceJobD1(
  d1: D1Database, input: ClaimNextConvergenceJobInput
): Promise<Result<ClaimNextConvergenceJobOutput, ConvergenceError>> {
  const nowMs = input.nowMs ?? Date.now();
  const candidates = input.jobId
    ? await getConvergenceJobByIdD1(d1, input.jobId, input.workspaceId).then((r) => (r.ok ? [r.value] : []))
    : await listConvergenceJobsByWorkspaceD1(d1, input.workspaceId);

  const claimable = candidates.find(
    (c) => !isTerminalConvergenceState(c) && (!c.leaseToken || c.leaseToken === input.leaseToken || (c.leaseExpiresAt ?? 0) <= nowMs)
  );
  if (!claimable) {
    if (input.jobId && candidates.length > 0) {
      const t = candidates[0];
      return isTerminalConvergenceState(t)
        ? failure({ code: 'TERMINAL_STATE_IMMUTABLE', message: `Job ${t.jobId} is already terminal` })
        : failure({ code: 'LEASE_HELD', message: `Active lease held on ${t.jobId}` });
    }
    return success({ claimed: false, record: null, leaseToken: null, mekongTicketId: null });
  }

  const leaseToken = input.leaseToken ?? `worker_lease_${input.workerId}_${claimable.jobId}_v${claimable.version}`;
  const leased = await acquireConvergenceLeaseD1(d1, claimable.jobId, input.workspaceId, leaseToken, input.leaseDurationMs ?? 60000, nowMs);
  if (!leased.ok) return failure(leased.error);

  let current = leased.value;
  let ticketId = current.mekongJobId;
  if (!ticketId) {
    const sub = await new MekongContractClient({ mode: 'ENABLED', d1 }).submitTaskAsync(
      { source_id: `worker_${input.workerId}`, event_id: current.idempotencyKey, goal: `Worker execution for ${current.jobId}`, workspace_id: input.workspaceId },
      current.attemptNo
    );
    if (sub.ok) {
      ticketId = sub.value.ticket.ticket_id;
      const cas = await transitionConvergenceCasD1(d1, {
        jobId: current.jobId, workspaceId: input.workspaceId, expectedVersion: current.version, leaseToken,
        mekongJobId: ticketId, executionMode: 'MEKONG_ENABLED', axes: { executionOutcome: 'running' }, nowMs,
      });
      if (cas.ok) current = cas.value;
    }
  }
  return success({ claimed: true, record: current, leaseToken, mekongTicketId: ticketId });
}

export async function completeWorkerAttemptD1(
  d1: D1Database, input: CompleteWorkerAttemptInput
): Promise<Result<CreativeJobSliceOutput, { code: string; message: string }>> {
  const curRes = await getConvergenceJobByIdD1(d1, input.jobId, input.workspaceId);
  if (!curRes.ok) return curRes;
  const cur = curRes.value;
  const manifest: ArtifactManifestEntry[] = input.artifactManifest ? [...input.artifactManifest] : [...cur.artifactManifest];
  let defaultCost = 0;
  for (const st of CREATIVE_JOB_12_STAGES) {
    if (st.stageId === 'crash_quarantine_recovery') continue;
    defaultCost += st.costUsd;
    if (!input.artifactManifest && st.producesArtifactKind && !manifest.some((m) => m.stageId === st.stageId)) {
      manifest.push(buildDeterministicStageArtifact(input.jobId, st.stageId, st.producesArtifactKind, input.simulateCorruptMedia));
    }
  }
  const attemptNo = input.attemptNo ?? cur.attemptNo;
  const verificationReport = verifyMediaArtifactManifest(manifest, `verif_${input.jobId}_att${attemptNo}`);
  const execOutcome = input.executionOutcome ?? 'succeeded';
  const verifOutcome = verificationReport.hasVerifiedMedia ? 'verified' : 'failed';
  const delivOutcome = input.deliveryOutcome ?? 'confirmed';
  const bizOutcome = input.businessOutcome ?? 'accepted';
  const fin = await transitionConvergenceCasD1(d1, {
    jobId: input.jobId, workspaceId: input.workspaceId, expectedVersion: input.expectedVersion, leaseToken: input.leaseToken,
    lifecycleStage: execOutcome === 'succeeded' ? 'converged_terminal' : 'media_integrity_verification',
    executionMode: 'MEKONG_ENABLED', attemptNo, actualCostUsd: input.actualCostUsd ?? defaultCost,
    artifactManifest: manifest, verificationReport, nowMs: input.nowMs,
    axes: { executionOutcome: execOutcome, verificationOutcome: verifOutcome, deliveryOutcome: delivOutcome, businessOutcome: bizOutcome },
  });
  if (!fin.ok) return fin;
  if (fin.value.mekongJobId) {
    const claimOk = execOutcome === 'succeeded' && verifOutcome === 'verified' && delivOutcome === 'confirmed';
    await d1.prepare(
      `UPDATE mekong_contract_tickets SET truth_status = ?1, execution_outcome = ?2, verification_outcome = ?3,
       delivery_outcome = ?4, verified_success_claim_permitted = ?5, actual_cost = ?6, updated_at = ?7 WHERE ticket_id = ?8`
    ).bind(
      claimOk ? 'VERIFIED_SUCCESS' : 'EXECUTION_FAILED', execOutcome === 'succeeded' ? 'EXECUTED' : 'EXECUTION_FAILED',
      verifOutcome === 'verified' ? 'VERIFIED_SUCCESS' : 'VERIFICATION_FAILED', delivOutcome === 'confirmed' ? 'DELIVERED' : 'DELIVERY_FAILED',
      claimOk ? 1 : 0, fin.value.actualCostUsd, input.nowMs ?? Date.now(), fin.value.mekongJobId
    ).run();
  }
  return finalizeD1Slice(d1, fin.value, fin.value.mekongJobId, false);
}
