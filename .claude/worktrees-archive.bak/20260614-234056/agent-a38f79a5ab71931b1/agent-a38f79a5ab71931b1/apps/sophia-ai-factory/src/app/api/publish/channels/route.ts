/**
 * POST /api/publish/channels
 *
 * Register a publishing channel (BYOK OAuth) — completes the multi-channel
 * distribution promise by exposing the registration algorithm as REST.
 * Supports all 12 providers backed by the publishing_channels CHECK
 * constraint: tiktok, youtube, instagram, pinterest, linkedin, zalo,
 * facebook, twitter, threads, reddit, bluesky, mastodon.
 *
 * Body:
 *   {
 *     provider: 'tiktok' | 'youtube' | ... ,
 *     externalAccountId: string,
 *     accessToken: string,
 *     refreshToken?: string,
 *     expiresAt?: number,
 *     displayName?: string
 *   }
 *
 * Auth: session cookie OR OpenClaw Bearer.
 *
 * @module app/api/publish/channels
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserOrOpenclawBearer } from '@/seed/auth/openclaw-token';
import {
  registerPublishingChannel,
  RegisterChannelError,
} from '@/land/publish/register-publishing-channel';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  provider: z.enum([
    'tiktok',
    'youtube',
    'instagram',
    'pinterest',
    'linkedin',
    'zalo',
    'facebook',
    'twitter',
    'threads',
    'reddit',
    'bluesky',
    'mastodon',
  ]),
  externalAccountId: z.string().min(1).max(120),
  accessToken: z.string().min(1).max(4096),
  refreshToken: z.string().min(1).max(4096).optional(),
  expiresAt: z.number().int().positive().optional(),
  displayName: z.string().max(120).optional(),
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
    const result = await registerPublishingChannel({ userId: user.id, ...parsed.data });
    return NextResponse.json(result, { status: result.alreadyExisted ? 200 : 201 });
  } catch (err) {
    if (err instanceof RegisterChannelError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
