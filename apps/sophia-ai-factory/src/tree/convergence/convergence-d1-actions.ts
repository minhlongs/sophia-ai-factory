/**
 * Tenant-Scoped Convergence Actions & Artifact Retrieval on D1 (Supreme #02.1 P2 & P5)
 *
 * Enforces workspace ownership before any cancel, CEO approval/reject/hold mutation,
 * or artifact manifest entry retrieval so cross-tenant callers receive `TENANT_MISMATCH`
 * with zero side effects.
 *
 * Layer: tree/convergence (imports seed only)
 */

import type { D1Database } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { isTerminalConvergenceState } from './convergence-projector';
import type { ConvergenceError } from './convergence-repo';
import { getConvergenceJobByIdD1 } from './convergence-d1-queries';
import type { ArtifactManifestEntry, BusinessOutcome, ConvergenceLedgerRecord } from './convergence-types';

export async function getConvergenceArtifactByIdD1(
  db: D1Database,
  jobId: string,
  workspaceId: string,
  artifactId: string
): Promise<Result<{ record: ConvergenceLedgerRecord; artifact: ArtifactManifestEntry }, ConvergenceError>> {
  const jobRes = await getConvergenceJobByIdD1(db, jobId, workspaceId);
  if (!jobRes.ok) return jobRes;
  const artifact = jobRes.value.artifactManifest.find((a) => a.artifactId === artifactId);
  if (!artifact) {
    return failure({ code: 'NOT_FOUND', message: `Artifact ${artifactId} not found in job ${jobId}` });
  }
  return success({ record: jobRes.value, artifact });
}

export async function cancelConvergenceJobD1(
  db: D1Database,
  jobId: string,
  workspaceId: string,
  nowMs = Date.now()
): Promise<Result<ConvergenceLedgerRecord, ConvergenceError>> {
  const currentRes = await getConvergenceJobByIdD1(db, jobId, workspaceId);
  if (!currentRes.ok) return currentRes;
  const current = currentRes.value;
  if (isTerminalConvergenceState(current)) {
    return failure({ code: 'TERMINAL_STATE_IMMUTABLE', message: `Job ${jobId} is already in terminal state` });
  }
  const upd = await db
    .prepare(
      `UPDATE authoritative_job_convergence_ledger
       SET version = version + 1, execution_outcome = 'cancelled', updated_at = ?1
       WHERE job_id = ?2 AND workspace_id = ?3 AND version = ?4`
    )
    .bind(nowMs, jobId, workspaceId, current.version)
    .run();
  if ((upd.meta?.changes ?? 0) === 0) {
    return failure({ code: 'CAS_VERSION_CONFLICT', message: 'Concurrent modification during cancel' });
  }
  return getConvergenceJobByIdD1(db, jobId, workspaceId);
}

export async function decideConvergenceApprovalD1(
  db: D1Database,
  jobId: string,
  workspaceId: string,
  decision: 'approve' | 'reject' | 'hold',
  nowMs = Date.now()
): Promise<Result<ConvergenceLedgerRecord, ConvergenceError>> {
  const currentRes = await getConvergenceJobByIdD1(db, jobId, workspaceId);
  if (!currentRes.ok) return currentRes;
  const current = currentRes.value;
  if (current.executionOutcome === 'cancelled' || current.businessOutcome === 'rejected') {
    return failure({ code: 'TERMINAL_STATE_IMMUTABLE', message: `Job ${jobId} is in immutable rejected/cancelled state` });
  }
  const nextBiz: BusinessOutcome =
    decision === 'approve' ? 'accepted' : decision === 'reject' ? 'rejected' : 'human_review_required';
  const nextExec = decision === 'reject' ? 'cancelled' : current.executionOutcome;
  const nextUncertain = decision === 'approve' ? 0 : current.sideEffectUncertain ? 1 : 0;
  const upd = await db
    .prepare(
      `UPDATE authoritative_job_convergence_ledger
       SET version = version + 1, business_outcome = ?1, execution_outcome = ?2,
           side_effect_uncertain = ?3, updated_at = ?4
       WHERE job_id = ?5 AND workspace_id = ?6 AND version = ?7`
    )
    .bind(nextBiz, nextExec, nextUncertain, nowMs, jobId, workspaceId, current.version)
    .run();
  if ((upd.meta?.changes ?? 0) === 0) {
    return failure({ code: 'CAS_VERSION_CONFLICT', message: 'Concurrent modification during approval decision' });
  }
  return getConvergenceJobByIdD1(db, jobId, workspaceId);
}
