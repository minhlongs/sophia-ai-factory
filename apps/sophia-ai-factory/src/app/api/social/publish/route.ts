/**
 * POST /api/social/publish
 *
 * Schedule a social publish event.
 * Inserts into publish_events table (Phase 4) and optionally invokes
 * the RnnScheduler to compute the optimal publish time.
 *
 * Body:
 * {
 *   provider: 'youtube'|'tiktok'|'instagram'|'facebook'|'telegram',
 *   contentTitle: string,
 *   contentHash?: string,
 *   scheduledAt?: number (unix ts),
 *   caption?: string,
 *   hashtags?: string[]
 * }
 *
 * Auth: session cookie required.
 *
 * @module app/api/social/publish
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getRnnScheduler } from '@/forest/publishing/rnn-scheduler';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  provider: z.enum([
    'youtube',
    'tiktok',
    'instagram',
    'facebook',
    'telegram',
  ]),
  contentTitle: z.string().min(1).max(200),
  contentHash: z.string().max(64).optional(),
  scheduledAt: z.number().int().positive().optional(),
  caption: z.string().max(5000).optional(),
  hashtags: z.array(z.string().max(50)).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_BODY', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { provider, contentTitle, contentHash, scheduledAt, caption, hashtags } = parsed.data;

  const db = getD1();
  if (!db) {
    return NextResponse.json({ error: 'DB_UNAVAILABLE' }, { status: 503 });
  }

  // Determine publish time: use explicit scheduledAt or compute RNN-optimal
  let finalScheduledAt: number;
  try {
    const scheduler = getRnnScheduler();
    if (scheduledAt) {
      finalScheduledAt = scheduledAt;
    } else {
      const result = await scheduler.getOptimalPublishTime(provider, contentHash ?? '');
      if (!result.time) {
        return NextResponse.json(
          { error: 'NO_OPTIMAL_TIME', message: 'Could not compute publish time' },
          { status: 422 },
        );
      }
      finalScheduledAt = Math.floor(result.time.getTime() / 1000);
    }
  } catch (err) {
    // If RNN fails, schedule for next hour as fallback
    const now = Math.floor(Date.now() / 1000);
    finalScheduledAt = now + 3600;
  }

  // Insert publish event
  const hashtagsJson = hashtags?.length ? JSON.stringify(hashtags) : null;

  try {
    const { meta } = await db
      .prepare(
        `INSERT INTO publish_events
          (user_id, provider, content_title, content_hash, scheduled_at, status, caption)
         VALUES (?, ?, ?, ?, ?, 'scheduled', ?)`,
      )
      .bind(user.id, provider, contentTitle, contentHash ?? null, finalScheduledAt, caption ?? null)
      .run();

    return NextResponse.json(
      {
        ok: true,
        eventId: meta?.last_insert_rowid,
        scheduledAt: finalScheduledAt,
        provider,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: 'INSERT_FAILED',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}
