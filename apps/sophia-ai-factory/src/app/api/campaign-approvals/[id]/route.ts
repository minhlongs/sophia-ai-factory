/**
 * /api/campaign-approvals/[id] — CEO Campaign Approval Resolution API
 *
 * PATCH  — approve / reject / revoke / resume a campaign approval.
 *
 * Auth: session-based; only workspace owner/admin may resolve. The tenant is
 * the approval row's own tenant_id (verified against the caller's membership),
 * never a client-supplied value.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { hasWorkspaceRole } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import {
  approveCampaignApprovalCAS,
  getCampaignApprovalById,
  markApprovalExecuted,
  rejectCampaignApproval,
  revokeCampaignApproval,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import { getExecutionRunByApprovalId } from '@/tree/affiliate/execution/execution-repo';
import { sendApprovalContinuation } from '../continuation';

export const dynamic = 'force-dynamic';

const resolveSchema = z.object({
  action: z.enum(['approve', 'reject', 'revoke', 'resume']),
  reason: z.string().max(500).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;
    const { action, reason } = parsed.data;

    const located = await locateTenantApproval(d1, user.id, id);
    if (!located) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }
    const { tenantId } = located;

    const isAuthorized = await hasWorkspaceRole(tenantId, user.id, 'ADMIN');
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Only workspace owner or admin can resolve approvals' },
        { status: 403 },
      );
    }

    if (action === 'reject') {
      const result = await rejectCampaignApproval(d1, {
        tenantId,
        approvalId: id,
        operatorId: user.id,
        reason,
      });
      if (!result.ok) return resolveError(result.error.code, result.error.message);
      logger.info('[api/campaign-approvals] Approval rejected', { approvalId: id, tenantId });
      return NextResponse.json({ status: result.value.status, approvalId: id });
    }

    if (action === 'revoke') {
      const result = await revokeCampaignApproval(d1, {
        tenantId,
        approvalId: id,
        operatorId: user.id,
        reason,
      });
      if (!result.ok) return resolveError(result.error.code, result.error.message);
      logger.info('[api/campaign-approvals] Approval revoked', { approvalId: id, tenantId });
      return NextResponse.json({ status: result.value.status, approvalId: id });
    }

    if (action === 'resume') {
      return resumeContinuation(d1, tenantId, id);
    }

    // approve: CAS first — only the winner sends the continuation.
    const approved = await approveCampaignApprovalCAS(d1, {
      tenantId,
      approvalId: id,
      operatorId: user.id,
    });
    if (!approved.ok) return resolveError(approved.error.code, approved.error.message);

    const sent = await sendApprovalContinuation(d1, tenantId, approved.value);
    if (!sent.ok) {
      // The approval is durably granted; the continuation failed safely (no
      // send on unverified terms). The operator can Resume after fixing terms.
      // Roll the row back to pending ONLY when terms were never verifiable?
      // No: the grant is a deliberate operator decision; keep it and report.
      logger.warn('[api/campaign-approvals] Approval granted but continuation not sent', {
        approvalId: id,
        tenantId,
        code: sent.code,
      });
      return NextResponse.json(
        {
          status: approved.value.status,
          approvalId: id,
          continuation: 'not_sent',
          continuationCode: sent.code,
          details: sent.message,
        },
        { status: 202 },
      );
    }

    logger.info('[api/campaign-approvals] Approval granted and continuation sent', {
      approvalId: id,
      tenantId,
    });
    return NextResponse.json({ status: approved.value.status, approvalId: id, continuation: 'sent' });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

/**
 * Loads the approval only through workspaces the caller belongs to. Tenant
 * comes from the row itself — a client-supplied tenant is never trusted, and
 * rows in foreign workspaces are indistinguishable from missing rows.
 */
async function locateTenantApproval(
  db: D1Database,
  userId: string,
  approvalId: string,
): Promise<{ tenantId: string } | null> {
  const { getUserWorkspaceIds } = await import('@/seed/auth/workspace-access');
  const workspaceIds = await getUserWorkspaceIds(userId, db);
  for (const wid of workspaceIds) {
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
async function resumeContinuation(
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

function resolveError(code: string, message: string): Response {
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
