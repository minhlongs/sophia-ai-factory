/**
 * GET /api/publish-approvals
 * List the publish approvals awaiting a human decision in the user's workspaces.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1, type D1Database } from '@/seed/db/client';
import { getUserWorkspaceIds } from '@/seed/auth/workspace-access';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { listPendingPublishApprovals } from '@/tree/publishing/approval';

export const dynamic = 'force-dynamic';

async function lookupChannelCreatorInfo(
  d1: D1Database,
  tenantId: string,
  channelId: string,
): Promise<{ creatorNickname: string } | undefined> {
  try {
    const channel = await d1
      .prepare('SELECT id, display_name FROM publishing_channels WHERE tenant_id = ? AND id = ? LIMIT 1')
      .bind(tenantId, channelId)
      .first<{ id?: string; display_name?: string | null }>();
    const displayName = typeof channel?.display_name === 'string' ? channel.display_name.trim() : '';
    return displayName ? { creatorNickname: displayName } : undefined;
  } catch {
    return undefined;
  }
}

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

    const enrichedApprovals = await Promise.all(
      approvals.map(async (row) => {
        const creatorInfo = await lookupChannelCreatorInfo(d1, row.tenantId, row.channelId);
        return {
          id: row.idempotencyKey,
          tenantId: row.tenantId,
          channelId: row.channelId,
          platform: row.platform,
          mediaRef: row.mediaRef,
          createdAt: row.createdAt,
          expiresAt: row.expiresAt,
          ...(creatorInfo ? { creatorInfo } : {}),
        };
      }),
    );

    logger.info('[api/publish-approvals] Listed pending publish approvals', {
      userId: user.id,
      count: enrichedApprovals.length,
    });

    return NextResponse.json({
      approvals: enrichedApprovals,
      count: enrichedApprovals.length,
      limit,
      workspaces: workspaceIds,
    });
  } catch (error) {
    logger.error('[api/publish-approvals] GET failed', {
      error: toError(error).message,
    });
    return NextResponse.json({ error: 'Failed to list publish approvals' }, { status: 500 });
  }
}
