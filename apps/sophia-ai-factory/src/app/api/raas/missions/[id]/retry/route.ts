/**
 * POST /api/raas/missions/[id]/retry
 *
 * Resets a `failed` mission back to `queued` so the existing execution pipeline
 * picks it up again. Idempotent guard: only failed missions can be retried.
 *
 * Auth: Better Auth session, user must own the mission's org.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

interface MissionRow {
  id: string;
  status: string;
  org_id: string;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createServerClient();

    const { data: existing, error: fetchError } = await db
      .from('missions')
      .select('id, status, org_id')
      .eq('id', id)
      .eq('org_id', user.id)
      .single();

    const mission = existing as MissionRow | null;
    if (fetchError || !mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }
    if (mission.status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed missions can be retried', currentStatus: mission.status },
        { status: 409 },
      );
    }

    const { data: updated, error: updateError } = await db
      .from('missions')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', user.id)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error('[POST /api/raas/missions/:id/retry] Update failed', updateError ? new Error(updateError.message) : undefined);
      return NextResponse.json({ error: 'Retry failed' }, { status: 500 });
    }

    logger.info('[mission-retry] Mission re-queued', { missionId: id, userId: user.id });
    return NextResponse.json({ mission: updated });
  } catch (err) {
    logger.error('[POST /api/raas/missions/:id/retry] Error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
