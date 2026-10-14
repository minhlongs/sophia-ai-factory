/**
 * POST /api/v1/videos/[id]/distribute
 * Insert publishing_jobs rows for selected channels + emit publish.scheduled events.
 *
 * @module app/api/v1/videos/[id]/distribute/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { schedulePublish } from '@/forest/publishing/schedule-publish';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { logger } from '@/seed/utils/logger-utility';
import {
  distributeSchema,
  clampDistributeScheduleTime,
  resolveConnectedChannels,
} from './distribute-helpers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id: videoId } = await params;

  return withRateLimit(async (req: NextRequest): Promise<NextResponse> => {
    const user = await getCurrentUserFromHeaders(req.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!videoId) return NextResponse.json({ error: 'Missing video id' }, { status: 400 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = distributeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    const { channelProviders, caption, scheduledAt } = parsed.data;
    const resolvedScheduledAt = clampDistributeScheduleTime(scheduledAt);
    const db = createServerClient().unwrap();

    const videoRow = await db
      .prepare('SELECT user_id FROM videos WHERE id = ? LIMIT 1')
      .bind(videoId)
      .first<{ user_id: string }>();

    if (!videoRow) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    if (videoRow.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { channelMap, missingProviders } = await resolveConnectedChannels(
      db,
      user.id,
      channelProviders,
    );

    if (missingProviders.length > 0) {
      return NextResponse.json(
        { error: 'Some channels are not connected', missingProviders },
        { status: 422 },
      );
    }

    const tenantId = user.id;
    const jobIds: string[] = [];

    for (const provider of channelProviders) {
      const channelId = channelMap.get(provider)!;
      try {
        const { jobId } = await schedulePublish(db, {
          channelId,
          videoId,
          tenantId,
          userId: user.id,
          caption,
          scheduledAt: resolvedScheduledAt,
          provider,
        });
        jobIds.push(jobId);
      } catch (err) {
        logger.error('[distribute] schedulePublish failed', err instanceof Error ? err : undefined, {
          provider,
          videoId,
        });
        return NextResponse.json(
          { error: `Failed to schedule publish for provider: ${provider}`, jobIds },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ jobIds }, { status: 200 });
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 10 } })(request);
}
