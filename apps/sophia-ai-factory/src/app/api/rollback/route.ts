/**
 * POST /api/rollback — trigger rollback for a mission
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { hasWorkspaceRole } from '@/seed/auth/workspace-access';
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

    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Get workspace
    const workspaceId = await resolveOrgId(user.id, d1);
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const isAuthorized = await hasWorkspaceRole(workspaceId, user.id, 'ADMIN', d1);
    if (!isAuthorized) {
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
      .bind(missionId, workspaceId)
      .first<{ id: string; status: string }>();

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Log rollback
    const logResult = await logRollback({
      workspaceId,
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
      workspaceId,
    });

    return NextResponse.json({ ok: true, rollback: logResult.value });
  } catch (error) {
    logger.error('[api/rollback] POST failed', {
      error: toError(error).message,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
