/**
 * POST /api/v1/videos/[id]/distribute
 * Insert publishing_jobs rows for selected channels + emit publish.scheduled events.
 *
 * Schema audit (2026-05-09):
 *   publishing_jobs columns: id, tenant_id, video_job_id, channel_id, status,
 *     caption, hashtags_json, product_link, scheduled_at, started_at, finished_at,
 *     retry_count, error, created_at
 *   publishing_channels: status='active' indicates connected (not a boolean column)
 *   Ownership check: videos.user_id = current_user.id
 *   Idempotency: deferred to publishExecute CAS (KISS — no new unique-key migration)
 *   video_job_id stores videos.id (canonical post Wave 17 Phase 02); publishExecute resolves
 *     video URL via getCanonicalVideoUrl(videoId, userId) from the videos table.
 *
 * @module app/api/v1/videos/[id]/distribute/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { schedulePublish } from '@/forest/publishing/schedule-publish';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { logger } from '@/seed/utils/logger-utility';
import type { ChannelProvider } from '@/lib/publishing/publisher-interface';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// 13 providers: 12 OAuth providers (publishing_channels) + 'telegram' (telegram_paired_chats).
// Telegram is a special-case: channel_id resolved from telegram_paired_chats.chat_id,
// not from publishing_channels. See Option A comment below.
const CHANNEL_PROVIDERS: [ChannelProvider, ...ChannelProvider[]] = [
  'tiktok', 'youtube', 'instagram', 'pinterest', 'linkedin', 'zalo',
  'facebook', 'twitter', 'threads', 'reddit', 'bluesky', 'mastodon', 'telegram',
];

const distributeSchema = z.object({
  channelProviders: z.array(z.enum(CHANNEL_PROVIDERS)).min(1).max(CHANNEL_PROVIDERS.length),
  caption: z.string().max(2200).optional(),
  /** Unix epoch seconds; clamped to [now, now+30days] */
  scheduledAt: z.number().int().positive().optional(),
});

/**
 * Raw D1 binding accessor for this edge route.
 *
 * Wave 17 Phase 05 canonical D1 swap — DEFERRED to Wave 18. Reason:
 *   createServerClient() returns D1Client which does not expose the underlying D1Database.
 *   schedulePublish(db: D1Database, ...) requires a raw D1Database binding.
 *   Switching route queries to D1Client AND changing schedulePublish signature forces
 *   complete rewrite of schedule-publish.test.ts (5 tests, all coupled to raw .prepare()/.bind()
 *   mock chain) — total LOC churn exceeds 30-line KISS threshold.
 *   Wave 18 candidate: introduce D1Client.unwrap() accessor or change schedulePublish to
 *   accept D1Client and update tests together in a dedicated refactor phase.
 */
function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

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

    // Clamp scheduledAt to [now, now+30days]
    const now = Math.floor(Date.now() / 1000);
    const maxScheduled = now + 30 * 24 * 3600;
    const resolvedScheduledAt = scheduledAt
      ? Math.min(Math.max(scheduledAt, now), maxScheduled)
      : now;

    const db = getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    // Ownership check: verify video belongs to current user
    const videoRow = await db
      .prepare('SELECT user_id FROM videos WHERE id = ? LIMIT 1')
      .bind(videoId)
      .first<{ user_id: string }>();

    if (!videoRow) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    if (videoRow.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Separate Telegram from OAuth providers.
    // Option A: Telegram is special-cased — channel_id resolved from telegram_paired_chats,
    // not publishing_channels. publishing_jobs.channel_id stores chat_id as surrogate
    // (valid since D1/SQLite has no FK enforcement on that column).
    const oauthProviders = channelProviders.filter((p) => p !== 'telegram');
    const hasTelegram = channelProviders.includes('telegram');

    // Build channel map for OAuth providers (publishing_channels lookup)
    const channelMap = new Map<string, string>();

    if (oauthProviders.length > 0) {
      const placeholders = oauthProviders.map(() => '?').join(',');
      const { results: channelRows } = await db
        .prepare(
          `SELECT id, provider FROM publishing_channels
           WHERE user_id = ? AND provider IN (${placeholders}) AND status = 'active'
           ORDER BY provider ASC`,
        )
        .bind(user.id, ...oauthProviders)
        .all<{ id: string; provider: string }>();

      for (const r of (channelRows ?? [])) {
        channelMap.set(r.provider, r.id);
      }
    }

    // For Telegram: look up paired chat from telegram_paired_chats WHERE paired_by = user.id.
    // LIMIT 1 is defensive; migration 0100 adds UNIQUE(paired_by) so at most 1 row exists.
    // Rate limit: max 5 Telegram distribute requests per minute (enforced by outer withRateLimit).
    if (hasTelegram) {
      const tgRow = await db
        .prepare(
          `SELECT chat_id FROM telegram_paired_chats WHERE paired_by = ? LIMIT 1`,
        )
        .bind(user.id)
        .first<{ chat_id: string }>();

      if (!tgRow) {
        return NextResponse.json(
          { error: 'Some channels are not connected', missingProviders: ['telegram'] },
          { status: 422 },
        );
      }
      // Use chat_id as surrogate channel_id for Telegram
      channelMap.set('telegram', tgRow.chat_id);
    }

    const missingProviders = channelProviders.filter((p) => !channelMap.has(p));
    if (missingProviders.length > 0) {
      return NextResponse.json(
        { error: 'Some channels are not connected', missingProviders },
        { status: 422 },
      );
    }

    // Insert a job per channel; collect jobIds
    const tenantId = user.id; // tenant_id = user.id convention throughout codebase
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
          // Pass provider so publishExecute can dispatch the Telegram code path
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
