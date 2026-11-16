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
  | 'invalidated_by_mutation'
  | 'executed'
  | 'aborted_by_kill_switch';

export interface StoredCampaignApproval {
  id: string;
  tenantId: string;
  campaignId: string;
  status: ApprovalStatus;
  approvalPayloadHash: string;
  approvedBy: string | null;
  approvedAtMs: number | null;
}

export interface ApprovalGuardError {
  code:
    | 'APPROVAL_NOT_GRANTED'
    | 'APPROVAL_INVALIDATED_BY_MUTATION'
    | 'APPROVAL_ABORTED_BY_KILL_SWITCH';
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

