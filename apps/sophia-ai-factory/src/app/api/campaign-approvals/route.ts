/**
 * GET /api/campaign-approvals
 * List CEO campaign approvals for a workspace the user belongs to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getUserWorkspaceIds } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import {
  listTenantApprovals,
  type ApprovalStatus,
} from '@/tree/affiliate/approval/campaign-approval-repo';

const VALID_STATUSES: ApprovalStatus[] = [
  'pending_ceo',
  'approved',
  'rejected',
  'revoked',
  'expired',
  'invalidated_by_mutation',
  'executed',
  'aborted_by_kill_switch',
];

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId') ?? '';
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const workspaceIds = await getUserWorkspaceIds(user.id, d1);
    if (!workspaceIds.includes(workspaceId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const statusParam = request.nextUrl.searchParams.get('status');
    const status = statusParam && (VALID_STATUSES as string[]).includes(statusParam)
      ? (statusParam as ApprovalStatus)
      : undefined;
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    const approvals = await listTenantApprovals(d1, workspaceId, { status, limit, offset });

    logger.info('[api/campaign-approvals] Listed campaign approvals', {
      userId: user.id,
      workspaceId,
      count: approvals.length,
    });

    return NextResponse.json({
      approvals: approvals.map((a) => ({
        id: a.id,
        campaignId: a.campaignId,
        niche: a.niche ?? null,
        jurisdiction: a.jurisdiction ?? null,
        status: a.status,
        approvalPayloadHash: a.approvalPayloadHash,
        approvedBy: a.approvedBy,
        approvedAt: a.approvedAtMs,
        expiresAt: a.expiresAtMs ?? null,
        revokedBy: a.revokedBy ?? null,
        revokedAt: a.revokedAtMs ?? null,
        executedAt: a.executedAtMs ?? null,
        rejectionReason: a.rejectionReason ?? null,
        createdAt: a.createdAtMs ?? null,
        payload: safeParseJson(a.payloadJson),
      })),
      count: approvals.length,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('[api/campaign-approvals] GET failed', {
      error: toError(error).message,
    });
    return NextResponse.json(
      { error: 'Failed to list campaign approvals', details: toError(error).message },
      { status: 500 },
    );
  }
}

function safeParseJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
