/**
 * Campaign Approval Integrity Guard
 *
 * Enforces CEO approval integrity for OPC Affiliate Agent campaigns.
 * Recomputes the SHA-256 payload digest before expensive video rendering or
 * social distribution; if the script, affiliate link, jurisdiction, disclosure,
 * or budget changed after approval, the approval is automatically invalidated.
 *
 * Layer: tree/affiliate/approval (Domain Logic)
 * @module tree/affiliate/approval/campaign-approval-guard
 */

import {
  computeApprovalPayloadHash,
  type CampaignApprovalPayload,
} from '@/seed/security/approval-payload-hash';
import { success, failure, type Result } from '@/seed/types/result';

export type ApprovalStatus =
  | 'pending_ceo'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'expired'
  | 'invalidated_by_mutation'
  | 'executed'
  | 'aborted_by_kill_switch';

export interface StoredCampaignApproval {
  id: string;
  tenantId: string;
  campaignId: string;
  niche?: string;
  jurisdiction?: string;
  status: ApprovalStatus;
  approvalPayloadHash: string;
  approvedBy: string | null;
  approvedAtMs: number | null;
  /** Canonical payload JSON persisted at draft time (may be absent on pre-0485 rows). */
  payloadJson?: string | null;
  /** Dispatch context JSON persisted at draft time (may be absent on pre-0485 rows). */
  dispatchJson?: string | null;
  /** Unix ms. Null means no expiry (pre-0485 row). */
  expiresAtMs?: number | null;
  revokedBy?: string | null;
  revokedAtMs?: number | null;
  executedAtMs?: number | null;
  rejectionReason?: string | null;
  createdAtMs?: number | null;
}

export interface ApprovalGuardError {
  code:
    | 'APPROVAL_NOT_GRANTED'
    | 'APPROVAL_INVALIDATED_BY_MUTATION'
    | 'APPROVAL_ABORTED_BY_KILL_SWITCH'
    | 'APPROVAL_REJECTED'
    | 'APPROVAL_REVOKED'
    | 'APPROVAL_EXPIRED'
    | 'APPROVAL_ALREADY_EXECUTED';
  message: string;
  nextStatus: ApprovalStatus;
  computedHash: string;
}

export interface ApprovalVerificationSuccess {
  approvalId: string;
  campaignId: string;
  verifiedHash: string;
  status: 'approved';
}

export async function verifyCampaignApprovalIntegrity(
  approval: StoredCampaignApproval,
  currentPayload: CampaignApprovalPayload,
  killSwitchActive = false,
  nowMs: number = Date.now(),
): Promise<Result<ApprovalVerificationSuccess, ApprovalGuardError>> {
  const computedHash = await computeApprovalPayloadHash(currentPayload);

  if (killSwitchActive || approval.status === 'aborted_by_kill_switch') {
    return failure({
      code: 'APPROVAL_ABORTED_BY_KILL_SWITCH',
      message: 'Emergency Kill Switch is active for this workspace; campaign execution aborted.',
      nextStatus: 'aborted_by_kill_switch',
      computedHash,
    });
  }

  if (approval.status === 'rejected') {
    return failure({
      code: 'APPROVAL_REJECTED',
      message: `Campaign approval ${approval.id} was rejected and cannot execute.`,
      nextStatus: 'rejected',
      computedHash,
    });
  }

  if (approval.status === 'revoked') {
    return failure({
      code: 'APPROVAL_REVOKED',
      message: `Campaign approval ${approval.id} was revoked and cannot execute.`,
      nextStatus: 'revoked',
      computedHash,
    });
  }

  if (approval.status === 'expired') {
    return failure({
      code: 'APPROVAL_EXPIRED',
      message: `Campaign approval ${approval.id} expired and cannot execute.`,
      nextStatus: 'expired',
      computedHash,
    });
  }

  if (approval.status === 'executed') {
    return failure({
      code: 'APPROVAL_ALREADY_EXECUTED',
      message: `Campaign approval ${approval.id} was already consumed by a run and cannot execute again.`,
      nextStatus: 'executed',
      computedHash,
    });
  }

  if (approval.expiresAtMs != null && nowMs >= approval.expiresAtMs) {
    return failure({
      code: 'APPROVAL_EXPIRED',
      message: `Campaign approval ${approval.id} expired and cannot execute.`,
      nextStatus: 'expired',
      computedHash,
    });
  }

  if (approval.status !== 'approved') {
    return failure({
      code: 'APPROVAL_NOT_GRANTED',
      message: `Campaign requires CEO approval before execution (current status: ${approval.status}).`,
      nextStatus: approval.status,
      computedHash,
    });
  }

  if (computedHash !== approval.approvalPayloadHash) {
    return failure({
      code: 'APPROVAL_INVALIDATED_BY_MUTATION',
      message:
        'Campaign script, affiliate link, jurisdiction, disclosure, or budget changed after CEO approval.',
      nextStatus: 'invalidated_by_mutation',
      computedHash,
    });
  }

  return success({
    approvalId: approval.id,
    campaignId: approval.campaignId,
    verifiedHash: computedHash,
    status: 'approved',
  });
}

export {
  createCampaignApproval,
  getCampaignApproval,
  approveCampaignApproval,
  verifyAndEnforceCampaignApprovalD1,
  type CreateCampaignApprovalInput,
} from './campaign-approval-repo';

