/**
 * Foundational Handover & Acceptance Types
 * Layer: seed (Zero dependencies on higher layers)
 *
 * @module seed/handover/handover-types
 */

export type AgencyType = 'b2b_saas' | 'ecom' | 'content_creator' | 'service' | 'other';

export type HandoverStatus = 'pending' | 'active' | 'at_risk' | 'churned';

export type HandoverSource = 'manual' | 'auto_payment' | 'auto_signup';

export type AcceptanceStatus = 'pending' | 'accepted' | 'rejected';

export interface CustomerHandoverRecord {
  id: string;
  customer_user_id: string;
  agency_name: string;
  agency_type: AgencyType | null;
  tier: string;
  starter_sops: string | null;
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
  tenant_id: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signer_role: string | null;
  certificate_hash: string | null;
  acceptance_status: AcceptanceStatus;
  verification_results: string | null;
  signed_at: number | null;
  verification_passed_at: number | null;
  certificate_r2_key: string | null;
  notes: string | null;
}

export interface HandoverAcceptanceInput {
  handoverId: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  notes?: string;
  acceptanceStatements?: string[];
}

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

export type {
  CheckpointId,
  CheckpointStatus,
  CheckpointResult,
  VerificationRunReport,
  DrDrillResult,
  SanitizedEnvResult,
  RunbookMetadata,
  RunbookContent,
} from './handover-verification-types';
