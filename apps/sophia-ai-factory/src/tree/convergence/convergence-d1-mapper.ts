/**
 * D1 Row <-> Domain Record Mapper for `authoritative_job_convergence_ledger`
 * Maps all 26 columns of migration 0494 without loss or `any` casts.
 *
 * Layer: tree/convergence (imports seed only)
 */

import type {
  ArtifactManifestEntry,
  BusinessOutcome,
  ConvergenceLedgerRecord,
  CreativeJobStageId,
  DeliveryOutcome,
  ExecutionModeBadge,
  ExecutionOutcome,
  MediaVerificationReport,
  VerificationOutcome,
} from './convergence-types';

export interface ConvergenceD1Row {
  job_id: string;
  workspace_id: string;
  user_id: string;
  mission_id: string | null;
  execution_run_id: string | null;
  mekong_job_id: string | null;
  idempotency_key: string;
  attempt_no: number;
  lease_token: string | null;
  lease_expires_at: number | null;
  version: number;
  lifecycle_stage: string;
  execution_outcome: string;
  verification_outcome: string;
  delivery_outcome: string;
  business_outcome: string;
  execution_mode: string;
  side_effect_uncertain: number;
  crash_preserved_path: string | null;
  estimated_cost_usd: number;
  actual_cost_usd: number;
  retry_cost_usd: number;
  artifact_manifest_json: string;
  verification_report_json: string;
  created_at: number;
  updated_at: number;
}

const DEFAULT_VERIFICATION_REPORT: MediaVerificationReport = {
  hasVerifiedMedia: false,
  checkedCount: 0,
  passedCount: 0,
  checksumMatched: false,
  durationValid: false,
};

export function parseArtifactManifestJson(raw: string | null | undefined): ArtifactManifestEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ArtifactManifestEntry[]) : [];
  } catch {
    return [];
  }
}

export function parseVerificationReportJson(raw: string | null | undefined): MediaVerificationReport {
  if (!raw) return { ...DEFAULT_VERIFICATION_REPORT };
  try {
    const parsed = JSON.parse(raw) as Partial<MediaVerificationReport>;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_VERIFICATION_REPORT };
    return {
      hasVerifiedMedia: Boolean(parsed.hasVerifiedMedia),
      checkedCount: Number(parsed.checkedCount ?? 0),
      passedCount: Number(parsed.passedCount ?? 0),
      checksumMatched: Boolean(parsed.checksumMatched),
      durationValid: Boolean(parsed.durationValid),
      ...(parsed.failureReason ? { failureReason: String(parsed.failureReason) } : {}),
    };
  } catch {
    return { ...DEFAULT_VERIFICATION_REPORT };
  }
}

export function mapD1RowToConvergenceRecord(row: ConvergenceD1Row): ConvergenceLedgerRecord {
  return {
    jobId: row.job_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    missionId: row.mission_id ?? null,
    executionRunId: row.execution_run_id ?? null,
    mekongJobId: row.mekong_job_id ?? null,
    idempotencyKey: row.idempotency_key,
    attemptNo: Number(row.attempt_no),
    leaseToken: row.lease_token ?? null,
    leaseExpiresAt: row.lease_expires_at !== null && row.lease_expires_at !== undefined ? Number(row.lease_expires_at) : null,
    version: Number(row.version),
    lifecycleStage: row.lifecycle_stage as CreativeJobStageId,
    executionOutcome: row.execution_outcome as ExecutionOutcome,
    verificationOutcome: row.verification_outcome as VerificationOutcome,
    deliveryOutcome: row.delivery_outcome as DeliveryOutcome,
    businessOutcome: row.business_outcome as BusinessOutcome,
    executionMode: row.execution_mode as ExecutionModeBadge,
    sideEffectUncertain: Number(row.side_effect_uncertain) === 1,
    crashPreservedPath: row.crash_preserved_path ?? null,
    estimatedCostUsd: Number(row.estimated_cost_usd ?? 0),
    actualCostUsd: Number(row.actual_cost_usd ?? 0),
    retryCostUsd: Number(row.retry_cost_usd ?? 0),
    artifactManifest: parseArtifactManifestJson(row.artifact_manifest_json),
    verificationReport: parseVerificationReportJson(row.verification_report_json),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}
