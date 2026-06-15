/**
 * POST /api/publish/quick-schedule
 *
 * Single-channel auto-publish scheduling — minimal contract suited for
 * the OpenClaw bridge + Telegram /publish ergonomic. The full
 * multi-channel + cooldown + quota flow lives at /api/publish/schedule.
 *
 * Body:
 *   {
 *     videoId: string,
 *     channelId: string,
 *     scheduledAt: number (unix seconds),
 *     caption?: string,
 *     hashtags?: string[],
 *     productLink?: string
 *   }
 *
 * Auth: session cookie OR OpenClaw Bearer.
 *
 * @module app/api/publish/quick-schedule
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserOrOpenclawBearer } from '@/seed/auth/openclaw-token';
import { schedulePublish, PublishConfigurationError } from '@/land/publish/schedule-video-publish';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  videoId: z.string().min(1).max(80),
  channelId: z.string().min(1).max(80),
  scheduledAt: z.number().int().positive(),
  caption: z.string().max(2000).optional(),
  hashtags: z.array(z.string().min(1).max(40)).max(20).optional(),
  productLink: z.string().url().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserOrOpenclawBearer(req.headers);
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

  try {
    const result = await schedulePublish({ userId: user.id, ...parsed.data });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PublishConfigurationError) {
      const statusMap: Record<typeof err.code, number> = {
        VIDEO_NOT_FOUND: 404,
        CHANNEL_NOT_FOUND: 404,
        FORBIDDEN: 403,
        SCHEDULED_IN_PAST: 422,
        INVALID_INPUT: 400,
      };
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: statusMap[err.code] ?? 400 },
      );
    }
    return NextResponse.json(
      { error: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
