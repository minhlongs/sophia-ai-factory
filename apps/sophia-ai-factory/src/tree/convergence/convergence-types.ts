/**
 * Authoritative Job Convergence Types (Gate S1, Gate S3, Gate S8)
 *
 * Defines the 12 creative stages, 4 independent outcome axes, execution modes,
 * CAS transition inputs, and unit economics metrics.
 *
 * Layer: tree/convergence (imports seed only)
 */

export type CreativeJobStageId =
  | 'creative_mission_intake'
  | 'niche_video_plan'
  | 'script_synthesis'
  | 'visual_storyboard'
  | 'ceo_approval_gate'
  | 'media_render_dispatch'
  | 'media_integrity_verification'
  | 'channel_delivery_publish'
  | 'delivery_receipt_reconcile'
  | 'budget_credit_accounting'
  | 'crash_quarantine_recovery'
  | 'converged_terminal';

export type ExecutionOutcome = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'crashed';
export type VerificationOutcome = 'pending' | 'verified' | 'failed' | 'skipped';
export type DeliveryOutcome = 'pending' | 'dispatched' | 'confirmed' | 'failed';
export type BusinessOutcome = 'pending' | 'accepted' | 'rejected' | 'human_review_required';

export type ExecutionModeBadge =
  | 'LOCAL_DETERMINISTIC'
  | 'SHADOW'
  | 'LOCAL_TEST'
  | 'MEKONG_ENABLED'
  | 'CLOUD_FALLBACK';

export interface ConvergenceAxes {
  executionOutcome: ExecutionOutcome;
  verificationOutcome: VerificationOutcome;
  deliveryOutcome: DeliveryOutcome;
  businessOutcome: BusinessOutcome;
}

export interface ArtifactManifestEntry {
  artifactId: string;
  stageId: CreativeJobStageId;
  kind: 'plan' | 'script' | 'visual' | 'video' | 'receipt';
  sha256: string;
  sizeBytes: number;
  uri: string;
  verified: boolean;
}

export interface MediaVerificationReport {
  hasVerifiedMedia: boolean;
  checkedCount: number;
  passedCount: number;
  checksumMatched: boolean;
  durationValid: boolean;
  failureReason?: string;
}

export interface ConvergenceLedgerRecord {
  jobId: string;
  workspaceId: string;
  userId: string;
  missionId: string | null;
  executionRunId: string | null;
  mekongJobId: string | null;
  idempotencyKey: string;
  attemptNo: number;
  leaseToken: string | null;
  leaseExpiresAt: number | null;
  version: number;
  lifecycleStage: CreativeJobStageId;
  executionOutcome: ExecutionOutcome;
  verificationOutcome: VerificationOutcome;
  deliveryOutcome: DeliveryOutcome;
  businessOutcome: BusinessOutcome;
  executionMode: ExecutionModeBadge;
  sideEffectUncertain: boolean;
  crashPreservedPath: string | null;
  estimatedCostUsd: number;
  actualCostUsd: number;
  retryCostUsd: number;
  artifactManifest: ArtifactManifestEntry[];
  verificationReport: MediaVerificationReport;
  createdAt: number;
  updatedAt: number;
}

export interface CreateConvergenceJobInput {
  jobId: string;
  workspaceId: string;
  userId: string;
  idempotencyKey: string;
  missionId?: string;
  executionRunId?: string;
  mekongJobId?: string;
  executionMode?: ExecutionModeBadge;
  estimatedCostUsd?: number;
  nowMs?: number;
}

export interface CasTransitionInput {
  jobId: string;
  workspaceId: string;
  expectedVersion: number;
  leaseToken: string;
  nowMs?: number;
  lifecycleStage?: CreativeJobStageId;
  axes?: Partial<ConvergenceAxes>;
  executionMode?: ExecutionModeBadge;
  attemptNo?: number;
  sideEffectUncertain?: boolean;
  crashPreservedPath?: string | null;
  actualCostUsd?: number;
  retryCostUsd?: number;
  artifactManifest?: ArtifactManifestEntry[];
  verificationReport?: MediaVerificationReport;
}

export interface UnitEconomicsSummary {
  costPerVerifiedJob: number;
  costPerAcceptedArtifact: number;
  verificationYield: number;
  businessAcceptanceYield: number;
  retryOverhead: number;
}
