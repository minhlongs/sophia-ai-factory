/**
 * Foundational Handover & Acceptance Types
 * Layer: seed (Zero dependencies on higher layers)
 *
 * Defines core domain contracts for Phase 20: 100/100 Automated Customer Handover,
 * Project Closeout & Operational Acceptance Engine.
 *
 * @module seed/handover/handover-types
 */

export type AgencyType = 'b2b_saas' | 'ecom' | 'content_creator' | 'service' | 'other';

export type HandoverStatus = 'pending' | 'active' | 'at_risk' | 'churned';

export type HandoverSource = 'manual' | 'auto_payment' | 'auto_signup';

export type AcceptanceStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Full record structure matching customer_handovers table in Cloudflare D1.
 * Extended with Phase 20 digital acceptance and certificate fields.
 */
export interface CustomerHandoverRecord {
  id: string;
  customer_user_id: string;
  agency_name: string;
  agency_type: AgencyType | null;
  tier: string;
  starter_sops: string | null; // JSON string array
  magic_link_token: string | null;
  magic_link_expires_at: number | null;
  created_by_admin_id: string;
  created_at: number;
  welcome_email_sent_at: number | null;
  customer_first_login_at: number | null;
  customer_first_sop_install_at: number | null;
  customer_first_run_at: number | null;
  status: HandoverStatus;
  source: HandoverSource;
  trigger_payment_id: string | null;
  // Phase 20 Digital Acceptance & Archival extensions:
  tenant_id: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signer_role: string | null;
  certificate_hash: string | null;
  acceptance_status: AcceptanceStatus;
  verification_results: string | null; // JSON string of CheckpointResult[]
  signed_at: number | null;           // Unix epoch ms
  verification_passed_at: number | null; // Unix epoch ms
  certificate_r2_key: string | null;
  notes: string | null;
}

/** Input required to record customer acceptance sign-off */
export interface HandoverAcceptanceInput {
  handoverId: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  notes?: string;
  acceptanceStatements?: string[];
}

/** Immutable certificate record stored in D1 handover_certificates */
export interface HandoverCertificate {
  id: string;
  handoverId: string;
  tenantId: string | null;
  customerName: string;
  customerEmail: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  tier: string;
  deployedSha: string;
  certificateSha256: string;
  verificationResults: string | null;
  contentMarkdown: string;
  metadataJson: string | null;
  createdAt: number;
}

/** Canonical payload used to calculate cryptographic SHA-256 digest */
export interface HandoverCertificatePayload {
  handoverId: string;
  tenantId?: string | null;
  customerName: string;
  customerEmail: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  tier: string;
  deployedSha: string;
  timestamp: number;
  acceptanceCheckpoints: string[];
  manifestHash?: string;
}

/** The 11 CEO Day-1 operational checkpoint identifiers */
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
