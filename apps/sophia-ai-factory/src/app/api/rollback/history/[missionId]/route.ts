/**
 * GET /api/rollback/history/[missionId] — fetch rollback history for a mission
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { getRollbackHistory } from '@/tree/rollback';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> },
) {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Get workspace
    const membership = await d1
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(user.id)
      .first<{ org_id: string }>();

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const { missionId } = await params;

    // Fetch rollback history
    const result = await getRollbackHistory(missionId);
    if (!result.ok) {
      logger.error('[api/rollback/history] getRollbackHistory failed', {
        error: result.error.message,
        missionId,
      });
      return NextResponse.json(
        { error: 'Failed to fetch rollback history' },
        { status: 500 },
      );
    }

    // Filter to only records belonging to this workspace
    const filtered = result.value.filter((r) => r.workspaceId === membership.org_id);

    return NextResponse.json({ ok: true, history: filtered });
  } catch (error) {
    logger.error('[api/rollback/history] GET failed', {
      error: toError(error).message,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
