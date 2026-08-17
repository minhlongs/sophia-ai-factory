/**
 * POST /api/rollback — trigger rollback for a mission
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { z } from 'zod';
import { logRollback } from '@/tree/rollback';

const PostBodySchema = z.object({
  missionId: z.string().uuid('Invalid mission ID format'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Get workspace
    const membership = await d1
      .prepare('SELECT org_id, role FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(user.id)
      .first<{ org_id: string; role: string }>();

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const allowedRoles = ['owner', 'admin'];
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only workspace owners or admins can trigger rollback' },
        { status: 403 },
      );
    }

    // Validate body
    const body = await request.json();
    const parsed = PostBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { missionId, reason } = parsed.data;

    // Fetch current mission
    const mission = await d1
      .prepare('SELECT id, status FROM missions WHERE id = ?1 AND workspace_id = ?2')
      .bind(missionId, membership.org_id)
      .first<{ id: string; status: string }>();

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Log rollback
    const logResult = await logRollback({
      workspaceId: membership.org_id,
      missionId,
      reason,
      fromStatus: mission.status,
      toStatus: 'rolled_back',
      triggeredBy: user.id,
    });

    if (!logResult.ok) {
      logger.error('[api/rollback] logRollback failed', {
        error: logResult.error.message,
        missionId,
      });
      return NextResponse.json(
        { error: 'Failed to log rollback', details: logResult.error.message },
        { status: 500 },
      );
    }

    logger.info('[api/rollback] POST success', {
      userId: user.id,
      missionId,
      workspaceId: membership.org_id,
    });

    return NextResponse.json({ ok: true, rollback: logResult.value });
  } catch (error) {
    logger.error('[api/rollback] POST failed', {
      error: toError(error).message,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
