/**
 * Cloudflare D1 SQL Mutations for `authoritative_job_convergence_ledger`
 * Implements atomic idempotency (`ON CONFLICT DO NOTHING`), lease acquisition,
 * and compare-and-swap (`version = version + 1`) against migration 0494.
 * Layer: tree/convergence (imports seed only)
 */

import type { D1Database } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { canAdvanceStage } from './convergence-projector';
import type { ConvergenceError } from './convergence-repo';
import { mapD1RowToConvergenceRecord, type ConvergenceD1Row } from './convergence-d1-mapper';
import { getConvergenceJobByIdD1 } from './convergence-d1-queries';
import type { CasTransitionInput, ConvergenceLedgerRecord, CreateConvergenceJobInput } from './convergence-types';

export async function createOrGetConvergenceJobD1(
  db: D1Database, input: CreateConvergenceJobInput
): Promise<Result<{ record: ConvergenceLedgerRecord; deduplicated: boolean }, ConvergenceError>> {
  const existingByKey = await db
    .prepare('SELECT * FROM authoritative_job_convergence_ledger WHERE workspace_id = ?1 AND idempotency_key = ?2')
    .bind(input.workspaceId, input.idempotencyKey)
    .first<ConvergenceD1Row>();
  if (existingByKey) return success({ record: mapD1RowToConvergenceRecord(existingByKey), deduplicated: true });

  const existingById = await db
    .prepare('SELECT job_id FROM authoritative_job_convergence_ledger WHERE job_id = ?1')
    .bind(input.jobId)
    .first<{ job_id: string }>();
  if (existingById) return failure({ code: 'IDEMPOTENCY_CONFLICT', message: `Job ${input.jobId} already exists` });

  const now = input.nowMs ?? Date.now();
  await db
    .prepare(
      `INSERT INTO authoritative_job_convergence_ledger (
        job_id, workspace_id, user_id, mission_id, execution_run_id, mekong_job_id,
        idempotency_key, attempt_no, lease_token, lease_expires_at, version,
        lifecycle_stage, execution_outcome, verification_outcome, delivery_outcome,
        business_outcome, execution_mode, side_effect_uncertain, crash_preserved_path,
        estimated_cost_usd, actual_cost_usd, retry_cost_usd,
        artifact_manifest_json, verification_report_json, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, NULL, NULL, 1, 'creative_mission_intake', 'pending', 'pending', 'pending', 'pending', ?8, 0, NULL, ?9, 0, 0, '[]', '{}', ?10, ?10)
      ON CONFLICT(workspace_id, idempotency_key) DO NOTHING`
    )
    .bind(
      input.jobId, input.workspaceId, input.userId, input.missionId ?? null,
      input.executionRunId ?? null, input.mekongJobId ?? null, input.idempotencyKey,
      input.executionMode ?? 'LOCAL_DETERMINISTIC', input.estimatedCostUsd ?? 0, now
    )
    .run();
  const row = await db
    .prepare('SELECT * FROM authoritative_job_convergence_ledger WHERE workspace_id = ?1 AND idempotency_key = ?2')
    .bind(input.workspaceId, input.idempotencyKey)
    .first<ConvergenceD1Row>();
  if (!row) return failure({ code: 'NOT_FOUND', message: `Job ${input.jobId} not persisted` });
  return success({ record: mapD1RowToConvergenceRecord(row), deduplicated: row.job_id !== input.jobId });
}

export async function acquireConvergenceLeaseD1(
  db: D1Database, jobId: string, workspaceId: string, leaseToken: string, ttlMs: number, nowMs = Date.now()
): Promise<Result<ConvergenceLedgerRecord, ConvergenceError>> {
  const currentRes = await getConvergenceJobByIdD1(db, jobId, workspaceId);
  if (!currentRes.ok) return currentRes;
  const current = currentRes.value;
  if (current.leaseToken && current.leaseToken !== leaseToken && (current.leaseExpiresAt ?? 0) > nowMs) {
    return failure({ code: 'LEASE_HELD', message: `Active lease held until ${current.leaseExpiresAt}` });
  }
  const upd = await db
    .prepare(
      `UPDATE authoritative_job_convergence_ledger
       SET lease_token = ?1, lease_expires_at = ?2, version = version + 1, updated_at = ?3
       WHERE job_id = ?4 AND workspace_id = ?5 AND version = ?6`
    )
    .bind(leaseToken, nowMs + ttlMs, nowMs, jobId, workspaceId, current.version)
    .run();
  if ((upd.meta?.changes ?? 0) === 0) return failure({ code: 'CAS_VERSION_CONFLICT', message: 'Concurrent lease modification' });
  return getConvergenceJobByIdD1(db, jobId, workspaceId);
}

export async function transitionConvergenceCasD1(
  db: D1Database, input: CasTransitionInput
): Promise<Result<ConvergenceLedgerRecord, ConvergenceError>> {
  const currentRes = await getConvergenceJobByIdD1(db, input.jobId, input.workspaceId);
  if (!currentRes.ok) return currentRes;
  const current = currentRes.value;
  if (current.version !== input.expectedVersion) {
    return failure({ code: 'CAS_VERSION_CONFLICT', message: `Expected version ${input.expectedVersion}, found ${current.version}` });
  }
  const now = input.nowMs ?? Date.now();
  const leaseExpired = (current.leaseExpiresAt ?? 0) <= now;
  if (current.leaseToken !== input.leaseToken || leaseExpired) {
    return failure({ code: 'LEASE_HELD', message: leaseExpired ? 'Lease expired; re-acquire first' : 'Lease token mismatch' });
  }
  if (input.lifecycleStage && !canAdvanceStage(current.lifecycleStage, input.lifecycleStage)) {
    return failure({ code: 'INVALID_STAGE_TRANSITION', message: `Cannot transition backwards from ${current.lifecycleStage} to ${input.lifecycleStage}` });
  }
  const upd = await db
    .prepare(
      `UPDATE authoritative_job_convergence_ledger
       SET version = version + 1, lifecycle_stage = ?1, execution_outcome = ?2, verification_outcome = ?3,
           delivery_outcome = ?4, business_outcome = ?5, execution_mode = ?6, attempt_no = ?7,
           mekong_job_id = ?8, side_effect_uncertain = ?9, crash_preserved_path = ?10,
           actual_cost_usd = ?11, retry_cost_usd = ?12, artifact_manifest_json = ?13,
           verification_report_json = ?14, updated_at = ?15
       WHERE job_id = ?16 AND workspace_id = ?17 AND version = ?18 AND lease_token = ?19 AND lease_expires_at > ?15`
    )
    .bind(
      input.lifecycleStage ?? current.lifecycleStage,
      input.axes?.executionOutcome ?? current.executionOutcome,
      input.axes?.verificationOutcome ?? current.verificationOutcome,
      input.axes?.deliveryOutcome ?? current.deliveryOutcome,
      input.axes?.businessOutcome ?? current.businessOutcome,
      input.executionMode ?? current.executionMode,
      input.attemptNo ?? current.attemptNo,
      input.mekongJobId !== undefined ? input.mekongJobId : current.mekongJobId,
      (input.sideEffectUncertain ?? current.sideEffectUncertain) ? 1 : 0,
      input.crashPreservedPath !== undefined ? input.crashPreservedPath : current.crashPreservedPath,
      input.actualCostUsd ?? current.actualCostUsd,
      input.retryCostUsd ?? current.retryCostUsd,
      JSON.stringify(input.artifactManifest ?? current.artifactManifest),
      JSON.stringify(input.verificationReport ?? current.verificationReport),
      now, input.jobId, input.workspaceId, input.expectedVersion, input.leaseToken
    )
    .run();
  if ((upd.meta?.changes ?? 0) === 0) return failure({ code: 'CAS_VERSION_CONFLICT', message: 'Atomic CAS update matched 0 rows' });
  return getConvergenceJobByIdD1(db, input.jobId, input.workspaceId);
}
