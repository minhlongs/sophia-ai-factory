/**
 * Cloudflare D1 Read & Sync Queries for `authoritative_job_convergence_ledger`
 *
 * Layer: tree/convergence (imports seed only)
 */

import type { D1Database } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import type { ConvergenceError } from './convergence-repo';
import { mapD1RowToConvergenceRecord, type ConvergenceD1Row } from './convergence-d1-mapper';
import type { ConvergenceLedgerRecord } from './convergence-types';

export async function getConvergenceJobByIdD1(
  db: D1Database,
  jobId: string,
  workspaceId: string
): Promise<Result<ConvergenceLedgerRecord, ConvergenceError>> {
  const row = await db
    .prepare('SELECT * FROM authoritative_job_convergence_ledger WHERE job_id = ?1')
    .bind(jobId)
    .first<ConvergenceD1Row>();
  if (!row) return failure({ code: 'NOT_FOUND', message: `Job ${jobId} not found` });
  if (row.workspace_id !== workspaceId) {
    return failure({ code: 'TENANT_MISMATCH', message: 'Cross-tenant access denied' });
  }
  return success(mapD1RowToConvergenceRecord(row));
}

export async function listConvergenceJobsByWorkspaceD1(
  db: D1Database,
  workspaceId: string
): Promise<ConvergenceLedgerRecord[]> {
  const res = await db
    .prepare(
      'SELECT * FROM authoritative_job_convergence_ledger WHERE workspace_id = ?1 ORDER BY created_at ASC'
    )
    .bind(workspaceId)
    .all<ConvergenceD1Row>();
  const rows = res.results ?? [];
  return rows.map(mapD1RowToConvergenceRecord);
}

export async function upsertConvergenceRecordD1(
  db: D1Database,
  record: ConvergenceLedgerRecord
): Promise<Result<ConvergenceLedgerRecord, ConvergenceError>> {
  const existing = await db
    .prepare('SELECT workspace_id FROM authoritative_job_convergence_ledger WHERE job_id = ?1')
    .bind(record.jobId)
    .first<{ workspace_id: string }>();
  if (existing && existing.workspace_id !== record.workspaceId) {
    return failure({ code: 'TENANT_MISMATCH', message: 'Cross-tenant upsert denied' });
  }
  await db
    .prepare(
      `INSERT INTO authoritative_job_convergence_ledger (
        job_id, workspace_id, user_id, mission_id, execution_run_id, mekong_job_id,
        idempotency_key, attempt_no, lease_token, lease_expires_at, version,
        lifecycle_stage, execution_outcome, verification_outcome, delivery_outcome,
        business_outcome, execution_mode, side_effect_uncertain, crash_preserved_path,
        estimated_cost_usd, actual_cost_usd, retry_cost_usd,
        artifact_manifest_json, verification_report_json, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26)
      ON CONFLICT(job_id) DO UPDATE SET
        attempt_no = excluded.attempt_no, lease_token = excluded.lease_token,
        lease_expires_at = excluded.lease_expires_at, version = excluded.version,
        mekong_job_id = excluded.mekong_job_id, lifecycle_stage = excluded.lifecycle_stage,
        execution_outcome = excluded.execution_outcome, verification_outcome = excluded.verification_outcome,
        delivery_outcome = excluded.delivery_outcome, business_outcome = excluded.business_outcome,
        execution_mode = excluded.execution_mode, side_effect_uncertain = excluded.side_effect_uncertain,
        crash_preserved_path = excluded.crash_preserved_path, actual_cost_usd = excluded.actual_cost_usd,
        retry_cost_usd = excluded.retry_cost_usd, artifact_manifest_json = excluded.artifact_manifest_json,
        verification_report_json = excluded.verification_report_json, updated_at = excluded.updated_at
      WHERE authoritative_job_convergence_ledger.workspace_id = excluded.workspace_id`
    )
    .bind(
      record.jobId, record.workspaceId, record.userId, record.missionId, record.executionRunId,
      record.mekongJobId, record.idempotencyKey, record.attemptNo, record.leaseToken,
      record.leaseExpiresAt, record.version, record.lifecycleStage, record.executionOutcome,
      record.verificationOutcome, record.deliveryOutcome, record.businessOutcome,
      record.executionMode, record.sideEffectUncertain ? 1 : 0, record.crashPreservedPath,
      record.estimatedCostUsd, record.actualCostUsd, record.retryCostUsd,
      JSON.stringify(record.artifactManifest), JSON.stringify(record.verificationReport),
      record.createdAt, record.updatedAt
    )
    .run();
  return getConvergenceJobByIdD1(db, record.jobId, record.workspaceId);
}
