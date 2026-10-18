/**
 * POST /api/v1/missions/[id]/generate-video
 *
 * Trigger an Inngest video generation job for a mission.
 * Auth: session-based via getCurrentUser().
 * Rate-limit: 5 req/min (expensive AI operation).
 *
 * Returns 202 Accepted with jobId reference.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { createServerClient } from '@/seed/db/client';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { reserveVideoSlot } from '@/tree/quota/video-quota';
import { errorResponse } from '@/seed/api';
import {
  GenerateVideoBody,
  BLOCKED_STATUSES,
  dispatchGenerateVideoEvent,
  type MissionRow,
} from './generate-video-helpers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: missionId } = await params;

  return withRateLimit(
    async (r: NextRequest) => {
      // ── Auth ─────────────────────────────────────────────────────────────
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const userId = user.id;

      // ── Validate body ─────────────────────────────────────────────────────
      let body: unknown;
      try {
        body = await r.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const parsed = GenerateVideoBody.safeParse(body);
      if (!parsed.success) {
        return errorResponse('Invalid request body', 'VALIDATION_ERROR', 400);
      }

      // ── Read mission from D1 ──────────────────────────────────────────────
      const db = createServerClient();
      const { data: mission } = await db
        .from('engine_missions')
        .select('id, user_id, status')
        .eq('id', missionId)
        .single() as { data: MissionRow | null; error: unknown };

      if (!mission) {
        return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
      }

      if (mission.user_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (BLOCKED_STATUSES.has(mission.status)) {
        return errorResponse(
          'Cannot generate video for this mission',
          'MISSION_STATUS_BLOCKED',
          409,
        );
      }

      // ── Quota gate (defense-in-depth) ────────────────────────────────────
      const tier = await resolveUserTier(userId);
      const reservation = await reserveVideoSlot(userId, tier);
      if (!reservation.reserved) {
        return errorResponse(
          'Video quota exceeded. Please upgrade your plan or wait for quota reset.',
          'QUOTA_EXCEEDED',
          429,
        );
      }

      // ── Send Inngest event ────────────────────────────────────────────────
      const jobId = await dispatchGenerateVideoEvent(missionId, userId, parsed.data);

      return NextResponse.json({ jobId, missionId, status: 'queued' }, { status: 202 });
    },
    { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 5 } },
  )(request);
}
