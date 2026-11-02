/**
 * /api/campaign-approvals/[id] — CEO Campaign Approval Resolution API
 *
 * PATCH  — approve / reject / revoke / resume a campaign approval.
 *
 * Auth: session-based; only workspace owner/admin may resolve. The tenant is
 * the approval row's own tenant_id (verified against the caller's solo
 * workspace or organization ADMIN membership), never a client-supplied value.
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
  rejectCampaignApproval,
  revokeCampaignApproval,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import { sendApprovalContinuation } from '../continuation';
import {
  locateTenantApproval,
  resolveApprovalError,
  resumeContinuation,
} from './approval-resolution-helpers';

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

    const isAuthorized =
      tenantId === user.id || (await hasWorkspaceRole(tenantId, user.id, 'ADMIN', d1));
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
      if (!result.ok) return resolveApprovalError(result.error.code, result.error.message);
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
      if (!result.ok) return resolveApprovalError(result.error.code, result.error.message);
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
    if (!approved.ok) return resolveApprovalError(approved.error.code, approved.error.message);

    const sent = await sendApprovalContinuation(d1, tenantId, approved.value);
    if (!sent.ok) {
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
