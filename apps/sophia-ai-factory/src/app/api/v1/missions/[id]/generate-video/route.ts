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
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { reserveVideoSlot, releaseVideoSlot } from '@/forest/quota/video-quota';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const GenerateVideoBody = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  voiceoverText: z.string().optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
  durationSec: z.number().int().positive().optional(),
  language: z.enum(['en', 'vi']).optional(),
});

interface MissionRow {
  id: string;
  user_id: string;
  status: string;
}

const BLOCKED_STATUSES = new Set(['failed', 'cancelled']);

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
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
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
        return NextResponse.json(
          { error: `Cannot trigger video generation for mission in status: ${mission.status}` },
          { status: 409 },
        );
      }

      // ── Quota gate (defense-in-depth) ────────────────────────────────────
      // Parity with generateVideoAction — without this, an authenticated user
      // could bypass server-action quota by POSTing directly to this route.
      const tier = await resolveUserTier(userId);
      const reservation = await reserveVideoSlot(userId, tier);
      if (!reservation.reserved) {
        return NextResponse.json(
          {
            error: `Video quota exceeded (${reservation.used}/${reservation.limit} used this month). Resets ${reservation.resetAt}.`,
            code: 'QUOTA_EXCEEDED',
          },
          { status: 429 },
        );
      }

      // ── Send Inngest event ────────────────────────────────────────────────
      let jobId: string | null;
      try {
        const { ids } = await inngest.send({
          name: 'video/generate.requested',
          data: {
            missionId,
            userId,
            prompt: parsed.data.prompt,
            voiceoverText: parsed.data.voiceoverText,
            aspectRatio: parsed.data.aspectRatio,
            durationSec: parsed.data.durationSec,
            language: parsed.data.language,
          },
        });
        jobId = ids[0] ?? null;
      } catch (err) {
        // Release the slot we just reserved — the job never queued.
        await releaseVideoSlot(userId).catch((err) => {
          logger.warn('Failed to release video slot after queuing error', {
            error: String(err),
            context: 'POST',
            missionId,
            userId,
          });
        });
        throw err;
      }

      return NextResponse.json({ jobId, missionId, status: 'queued' }, { status: 202 });
    },
    { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 5 } },
  )(request);
}
