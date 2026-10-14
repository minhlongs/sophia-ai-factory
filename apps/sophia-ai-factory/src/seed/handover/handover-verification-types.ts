/**
 * Verification checkpoints, DR drill, and runbook contracts for Customer Handover.
 * @module seed/handover/handover-verification-types
 */

export type CheckpointId =
  | 'edge_responsiveness'
  | 'sha_parity'
  | 'd1_crud_consistency'
  | 'r2_video_bucket'
  | 'r2_backups_bucket'
  | 'auth_session_readiness'
  | 'payments_nowpayments'
  | 'notifications_telegram'
  | 'monitoring_betterstack'
  | 'dr_drill_backup'
  | 'byok_vault_encryption'
  | 'runbooks_completeness';

export type CheckpointStatus = 'PASS' | 'FAIL' | 'WARN';

export interface CheckpointResult {
  checkpointId: CheckpointId | string;
  name: string;
  nameVi: string;
  category: 'edge' | 'database' | 'storage' | 'auth' | 'payments' | 'notifications' | 'operations' | 'security';
  status: CheckpointStatus;
  latencyMs: number;
  details: string;
  expected?: string;
  actual?: string;
  error?: string;
  diagnosticData?: Record<string, unknown>;
}

export interface VerificationRunReport {
  runId: string;
  timestamp: string;
  durationMs: number;
  overallVerdict: 'PASS' | 'FAIL' | 'WARN';
  totalChecks: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  deployedSha: string;
  localSha: string;
  shaMatched: boolean;
  checkpoints: CheckpointResult[];
}

export interface DrDrillResult {
  status: 'PASS' | 'FAIL' | 'WARN';
  latencyMs: number;
  tablesVerified: number;
  tableList: string[];
  r2BackupObjectFound: boolean;
  latestBackupKey?: string;
  latestBackupSizeBytes?: number;
  writeProbeSuccessful: boolean;
  readProbeSuccessful: boolean;
  checksumMatched: boolean;
  details: string;
  error?: string;
}

export interface SanitizedEnvResult {
  sanitizedContent: string;
  missingKeys: string[];
  totalKeys: number;
  sectionCount: number;
  warnings: string[];
}

export interface RunbookMetadata {
  id: string;
  slug: string;
  number: string;
  titleEn: string;
  titleVi: string;
  summaryEn: string;
  summaryVi: string;
  category: string;
  readTimeMinutes: number;
  tags: string[];
}

export interface RunbookContent extends RunbookMetadata {
  contentEn: string;
  contentVi: string;
  lastVerified: string;
  author: string;
}
