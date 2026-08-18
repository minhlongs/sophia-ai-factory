/**
 * GET /api/analytics/cross-channel
 *
 * Cross-Channel Dashboard — aggregates performance + ROI per ChannelProvider.
 * Covers all 14 channels (tiktok, youtube, instagram, ... whatsapp).
 * Returns zero-filled metrics for channels with no data.
 *
 * Query params:
 *   org_id  — workspace ID (admin only, defaults to user's workspace)
 *
 * RBAC:
 *   Admin / MASTER — any workspace
 *   ENTERPRISE+    — own workspace only
 *
 * Layer: app/api (orchestrator — calls forest resolvers)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { checkAdmin } from '@/land/analytics/rbac';
import { resolveCrossChannel } from '@/forest/analytics/queries/cross-channel-resolver';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  org_id: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 },
      );
    }

    const validation = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const isAdmin = await checkAdmin(user.id);
    const { org_id } = validation.data;

    let workspaceId: string;
    if (org_id && isAdmin) {
      workspaceId = org_id;
    } else if (org_id && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied - org_id filter is admin only' },
        { status: 403 },
      );
    } else {
      workspaceId = user.id;
    }

    const tier = await resolveUserTier(user.id);
    if (tier === 'BASIC' || tier === 'PREMIUM') {
      return NextResponse.json(
        { error: 'Access denied - cross-channel requires ENTERPRISE tier or admin' },
        { status: 403 },
      );
    }

    const result = await resolveCrossChannel(workspaceId);

    logger.info('[Cross-Channel] Dashboard query', {
      userId: user.id,
      workspaceId,
      channelsWithEvents: result.channels.filter(c => c.events > 0).length,
      hasData: result.hasData,
    });

    return NextResponse.json({
      ...result,
      queriedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      '[Cross-Channel] Critical error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { error: 'Failed to query cross-channel data' },
      { status: 500 },
    );
  }
}
