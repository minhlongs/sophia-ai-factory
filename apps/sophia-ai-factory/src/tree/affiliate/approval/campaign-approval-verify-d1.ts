/**
 * D1 Integrity Verification & Enforcement for CEO Campaign Approvals (`agent_campaign_approvals`)
 *
 * Layer: tree/affiliate/approval (Domain Logic)
 * @module tree/affiliate/approval/campaign-approval-verify-d1
 */

import {
  computeApprovalPayloadHash,
  type CampaignApprovalPayload,
} from '@/seed/security/approval-payload-hash';
import { failure, type Result } from '@/seed/types/result';
import {
  verifyCampaignApprovalIntegrity,
  type ApprovalGuardError,
  type ApprovalVerificationSuccess,
} from './campaign-approval-guard';
import { getCampaignApproval, getCampaignApprovalById } from './campaign-approval-queries';
import type { VerifyEnforceOptions } from './campaign-approval-repo-types';

export async function verifyAndEnforceCampaignApprovalD1(
  db: D1Database,
  tenantId: string,
  campaignId: string,
  currentPayload: CampaignApprovalPayload,
  killSwitchActive = false,
  options: VerifyEnforceOptions = {},
): Promise<Result<ApprovalVerificationSuccess, ApprovalGuardError>> {
  const now = options.nowMs ?? Date.now();
  const stored = options.approvalId
    ? await getCampaignApprovalById(db, tenantId, options.approvalId)
    : await getCampaignApproval(db, tenantId, campaignId);
  if (!stored) {
    const computedHash = await computeApprovalPayloadHash(currentPayload);
    return failure({
      code: 'APPROVAL_NOT_GRANTED',
      message: options.approvalId
        ? `Approval ${options.approvalId} does not exist in workspace ${tenantId}.`
        : `No approval record exists for campaign ${campaignId} in workspace ${tenantId}.`,
      nextStatus: 'pending_ceo',
      computedHash,
    });
  }

  const verification = await verifyCampaignApprovalIntegrity(
    stored,
    currentPayload,
    killSwitchActive,
    now,
  );

  if (!verification.ok && verification.error.nextStatus !== stored.status) {
    await db
      .prepare(
        `UPDATE agent_campaign_approvals
         SET status = ?, invalidated_reason = ?
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(
        verification.error.nextStatus,
        verification.error.message,
        stored.id,
        tenantId,
      )
      .run();
  }

  return verification;
}
