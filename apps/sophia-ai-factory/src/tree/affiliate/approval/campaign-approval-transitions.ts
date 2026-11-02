/**
 * CAS State Transitions for CEO Campaign Approvals (`agent_campaign_approvals`)
 *
 * Layer: tree/affiliate/approval (Domain Logic)
 * @module tree/affiliate/approval/campaign-approval-transitions
 */

import { success, failure, type Result } from '@/seed/types/result';
import { isMissingTableError } from '@/seed/auth/org-resolver/d1-org-queries';
import { getExecutionRunByApprovalId } from '../execution/execution-repo';
import { getCampaignApproval, getCampaignApprovalById } from './campaign-approval-queries';
import type {
  ApprovalResolveErrorCode,
  ResolveApprovalInput,
  StoredCampaignApproval,
} from './campaign-approval-repo-types';

type ResolveResult = Result<StoredCampaignApproval, { code: ApprovalResolveErrorCode; message: string }>;

async function runCasUpdate(
  db: D1Database,
  tenantId: string,
  approvalId: string,
  sql: string,
  params: unknown[],
): Promise<ResolveResult> {
  try {
    const res = await db.prepare(sql).bind(...params).run();
    if ((res.meta?.changes ?? 0) === 0) {
      return failure({
        code: 'APPROVAL_STATE_CONFLICT',
        message: `Approval ${approvalId} was resolved concurrently`,
      });
    }
    const updated = await getCampaignApprovalById(db, tenantId, approvalId);
    if (!updated) {
      return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${approvalId} not found` });
    }
    return success(updated);
  } catch (err) {
    return failure({
      code: 'APPROVAL_PERSIST_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function approveCampaignApprovalCAS(
  db: D1Database,
  input: ResolveApprovalInput,
): Promise<ResolveResult> {
  const now = input.nowMs ?? Date.now();
  const existing = await getCampaignApprovalById(db, input.tenantId, input.approvalId);
  if (!existing) {
    return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${input.approvalId} not found` });
  }
  if (existing.expiresAtMs != null && now >= existing.expiresAtMs && existing.status === 'pending_ceo') {
    await db
      .prepare(`UPDATE agent_campaign_approvals SET status = 'expired' WHERE id = ? AND tenant_id = ? AND status = 'pending_ceo'`)
      .bind(input.approvalId, input.tenantId)
      .run();
    return failure({ code: 'APPROVAL_EXPIRED', message: `Approval ${input.approvalId} expired` });
  }
  if (existing.status !== 'pending_ceo') {
    return failure({
      code: 'APPROVAL_STATE_CONFLICT',
      message: `Approval ${input.approvalId} is ${existing.status}, not pending`,
    });
  }
  return runCasUpdate(
    db,
    input.tenantId,
    input.approvalId,
    `UPDATE agent_campaign_approvals
     SET status = 'approved', approved_by = ?, approved_at = ?
     WHERE id = ? AND tenant_id = ? AND status = 'pending_ceo'`,
    [input.operatorId, now, input.approvalId, input.tenantId],
  );
}

export async function rejectCampaignApproval(
  db: D1Database,
  input: ResolveApprovalInput,
): Promise<ResolveResult> {
  const existing = await getCampaignApprovalById(db, input.tenantId, input.approvalId);
  if (!existing) {
    return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${input.approvalId} not found` });
  }
  if (existing.status !== 'pending_ceo') {
    return failure({
      code: 'APPROVAL_STATE_CONFLICT',
      message: `Approval ${input.approvalId} is ${existing.status}, not pending`,
    });
  }
  return runCasUpdate(
    db,
    input.tenantId,
    input.approvalId,
    `UPDATE agent_campaign_approvals
     SET status = 'rejected', rejection_reason = ?
     WHERE id = ? AND tenant_id = ? AND status = 'pending_ceo'`,
    [input.reason ?? null, input.approvalId, input.tenantId],
  );
}

export async function revokeCampaignApproval(
  db: D1Database,
  input: ResolveApprovalInput,
): Promise<ResolveResult> {
  const now = input.nowMs ?? Date.now();
  const existing = await getCampaignApprovalById(db, input.tenantId, input.approvalId);
  if (!existing) {
    return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${input.approvalId} not found` });
  }
  if (existing.status !== 'pending_ceo' && existing.status !== 'approved' && existing.status !== 'executed') {
    return failure({
      code: 'APPROVAL_STATE_CONFLICT',
      message: `Only a pending_ceo, approved, or pre-publish executed row can be revoked (current: ${existing.status})`,
    });
  }
  if (existing.status === 'executed') {
    try {
      const boundRun = await getExecutionRunByApprovalId(db, input.tenantId, input.approvalId);
      if (boundRun?.state === 'published') {
        return failure({
          code: 'APPROVAL_STATE_CONFLICT',
          message: `Approval ${input.approvalId} cannot be revoked after execution run ${boundRun.id} reached published`,
        });
      }
    } catch (err) {
      if (!isMissingTableError(err)) {
        return failure({ code: 'APPROVAL_PERSIST_FAILED', message: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  return runCasUpdate(
    db,
    input.tenantId,
    input.approvalId,
    `UPDATE agent_campaign_approvals
     SET status = 'revoked', revoked_by = ?, revoked_at = ?, rejection_reason = ?
     WHERE id = ? AND tenant_id = ? AND status IN ('pending_ceo', 'approved', 'executed')`,
    [input.operatorId, now, input.reason ?? null, input.approvalId, input.tenantId],
  );
}

export async function markApprovalExecuted(
  db: D1Database,
  tenantId: string,
  approvalId: string,
  nowMs: number = Date.now(),
): Promise<ResolveResult> {
  const existing = await getCampaignApprovalById(db, tenantId, approvalId);
  if (!existing) {
    return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${approvalId} not found` });
  }
  if (existing.status === 'executed') return success(existing);
  if (existing.status !== 'approved') {
    return failure({
      code: 'APPROVAL_STATE_CONFLICT',
      message: `Only an approved row can be consumed (current: ${existing.status})`,
    });
  }
  return runCasUpdate(
    db,
    tenantId,
    approvalId,
    `UPDATE agent_campaign_approvals
     SET status = 'executed', executed_at = ?
     WHERE id = ? AND tenant_id = ? AND status = 'approved'`,
    [nowMs, approvalId, tenantId],
  );
}

export async function approveCampaignApproval(
  db: D1Database,
  tenantId: string,
  campaignId: string,
  approvedBy: string,
): Promise<Result<StoredCampaignApproval, { code: string; message: string }>> {
  const existing = await getCampaignApproval(db, tenantId, campaignId);
  if (!existing) {
    return failure({
      code: 'APPROVAL_NOT_FOUND',
      message: `No campaign approval found for tenant ${tenantId} and campaign ${campaignId}`,
    });
  }
  const now = Date.now();
  await db
    .prepare(
      `UPDATE agent_campaign_approvals
       SET status = 'approved', approved_by = ?, approved_at = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .bind(approvedBy, now, existing.id, tenantId)
    .run();
  return success({ ...existing, status: 'approved', approvedBy, approvedAtMs: now });
}
