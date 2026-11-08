/**
 * GET /api/publish-approvals
 * List the publish approvals awaiting a human decision in the user's workspaces.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getUserWorkspaceIds } from '@/seed/auth/workspace-access';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { listPendingPublishApprovals } from '@/tree/publishing/approval';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const limit = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1),
      100,
    );
    const workspaceIds = await getUserWorkspaceIds(user.id, d1);
    const approvals = await listPendingPublishApprovals(workspaceIds, limit, d1);

    logger.info('[api/publish-approvals] Listed pending publish approvals', {
      userId: user.id,
      count: approvals.length,
    });

    return NextResponse.json({
      approvals: approvals.map((row) => ({
        id: row.idempotencyKey,
        tenantId: row.tenantId,
        channelId: row.channelId,
        platform: row.platform,
        mediaRef: row.mediaRef,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      })),
      count: approvals.length,
      limit,
      workspaces: workspaceIds,
    });
  } catch (error) {
    logger.error('[api/publish-approvals] GET failed', {
      error: toError(error).message,
    });
    // The detail is logged, never returned: D1 error text can carry SQL
    // fragments and table names that a probing caller has no need to see.
    return NextResponse.json({ error: 'Failed to list publish approvals' }, { status: 500 });
  }
}
