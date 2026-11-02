/**
 * Helpers for CEO Campaign Approval Resolution API (`/api/campaign-approvals/[id]`).
 *
 * Locates tenant-scoped approvals across both solo owner workspaces (`userId`)
 * and organization memberships (`org_members`), and handles stuck continuation
 * recovery and HTTP error mapping.
 *
 * @module app/api/campaign-approvals/[id]/approval-resolution-helpers
 */

import { NextResponse } from 'next/server';
import { getUserWorkspaceIds } from '@/seed/auth/workspace-access';
import { logger } from '@/seed/utils/logger-utility';
import {
  getCampaignApprovalById,
  markApprovalExecuted,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import { getExecutionRunByApprovalId } from '@/tree/affiliate/execution/execution-repo';
import { sendApprovalContinuation } from '../continuation';

/**
 * Loads the approval only through workspaces the caller belongs to (including
 * their solo workspace `userId` and any organization workspaces). Tenant comes
 * from the row itself — a client-supplied tenant is never trusted, and rows in
 * foreign workspaces are indistinguishable from missing rows.
 */
export async function locateTenantApproval(
  db: D1Database,
  userId: string,
  approvalId: string,
): Promise<{ tenantId: string } | null> {
  const orgWorkspaceIds = await getUserWorkspaceIds(userId, db);
  const candidateTenants = Array.from(new Set([userId, ...orgWorkspaceIds]));
  for (const wid of candidateTenants) {
    const row = await getCampaignApprovalById(db, wid, approvalId);
    if (row) return { tenantId: wid };
  }
  return null;
}

/**
 * Recovery path for approvals granted but never consumed (crash between the
 * approve-CAS and the continuation send, or a lost event). Re-checks the run
 * table before re-sending so a consumed approval is marked executed instead.
 */
export async function resumeContinuation(
  db: D1Database,
  tenantId: string,
  approvalId: string,
): Promise<Response> {
  const approval = await getCampaignApprovalById(db, tenantId, approvalId);
  if (!approval) {
    return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
  }
  if (approval.status !== 'approved') {
    return NextResponse.json(
      { error: `Only an approved row can be resumed (current: ${approval.status})` },
      { status: 409 },
    );
  }
  if (approval.expiresAtMs != null && Date.now() >= approval.expiresAtMs) {
    return NextResponse.json({ error: 'Approval expired' }, { status: 410 });
  }

  const existingRun = await getExecutionRunByApprovalId(db, tenantId, approvalId);
  if (existingRun) {
    await markApprovalExecuted(db, tenantId, approvalId);
    return NextResponse.json({
      status: 'executed',
      approvalId,
      runId: existingRun.id,
      runState: existingRun.state,
      resumed: false,
    });
  }

  const sent = await sendApprovalContinuation(db, tenantId, approval);
  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.message, code: sent.code, approvalId },
      { status: sent.code === 'TERMS_UNVERIFIED' ? 422 : 502 },
    );
  }
  logger.info('[api/campaign-approvals] Stuck approval resumed', { approvalId, tenantId });
  return NextResponse.json({ status: 'approved', approvalId, resumed: true });
}

export function resolveApprovalError(code: string, message: string): Response {
  const status =
    code === 'APPROVAL_NOT_FOUND'
      ? 404
      : code === 'APPROVAL_STATE_CONFLICT'
        ? 409
        : code === 'APPROVAL_EXPIRED'
          ? 410
          : 500;
  return NextResponse.json({ error: message, code }, { status });
}
