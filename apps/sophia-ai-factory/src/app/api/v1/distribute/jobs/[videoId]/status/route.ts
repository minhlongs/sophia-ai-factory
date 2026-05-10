/**
 * GET /api/v1/distribute/jobs/[videoId]/status
 * Returns publishing_jobs rows for the current user + given videoId.
 *
 * Ownership: publishing_channels.user_id = session.user.id
 *   JOIN ensures user can only read their own jobs.
 * Telegram special-case: channel_id stores telegram_paired_chats.chat_id as surrogate.
 *   LEFT JOIN handles this — provider='telegram' rows have no matching publishing_channels row
 *   but are still scoped via tenant_id = user.id.
 *
 * @module app/api/v1/distribute/jobs/[videoId]/status/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { logger } from '@/seed/utils/logger-utility';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const videoIdSchema = z.string().uuid();

/** Strip sensitive patterns from last_error field before returning to client */
function sanitizeError(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/token=[^\s&]*/gi, 'token=[REDACTED]')
    .slice(0, 200);
}

interface JobRow {
  id: string;
  channel_id: string;
  provider: string;
  status: string;
  retry_count: number;
  error: string | null;
  updated_at: number | null;
}

type RouteContext = { params: Promise<{ videoId: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { videoId } = await params;

  return withRateLimit(async (req: NextRequest): Promise<NextResponse> => {
    const user = await getCurrentUserFromHeaders(req.headers);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = videoIdSchema.safeParse(videoId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid videoId — must be a UUID' }, { status: 400 });
    }

    const db = createServerClient().unwrap();

    // Verify video exists and belongs to current user
    const videoRow = await db
      .prepare('SELECT user_id FROM videos WHERE id = ? LIMIT 1')
      .bind(videoId)
      .first<{ user_id: string }>();

    if (!videoRow || videoRow.user_id !== user.id) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Fetch jobs:
    //   - OAuth providers: JOIN publishing_channels to enforce user ownership
    //   - Telegram: tenant_id = user.id (no publishing_channels row)
    //   UNION approach keeps query simple and covers both cases.
    const { results } = await db
      .prepare(
        `SELECT pj.id, pj.channel_id, pj.provider, pj.status, pj.retry_count,
                pj.error, pj.created_at AS updated_at
         FROM publishing_jobs pj
         JOIN publishing_channels pc ON pj.channel_id = pc.id
         WHERE pc.user_id = ? AND pj.video_job_id = ?
         UNION
         SELECT pj.id, pj.channel_id, pj.provider, pj.status, pj.retry_count,
                pj.error, pj.created_at AS updated_at
         FROM publishing_jobs pj
         WHERE pj.provider = 'telegram' AND pj.tenant_id = ? AND pj.video_job_id = ?
         ORDER BY updated_at ASC`,
      )
      .bind(user.id, videoId, user.id, videoId)
      .all<JobRow>();

    const jobs = (results ?? []).map((row) => ({
      id: row.id,
      channelId: row.channel_id,
      provider: row.provider,
      status: row.status,
      attempts: row.retry_count,
      lastError: sanitizeError(row.error),
      updatedAt: row.updated_at,
    }));

    logger.info('[distribute/jobs/status] Returning jobs', { userId: user.id, videoId, count: jobs.length });

    return NextResponse.json(
      { jobs },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'CDN-Cache-Control': 'no-store',
          Vary: 'Authorization',
        },
      },
    );
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } })(request);
}
