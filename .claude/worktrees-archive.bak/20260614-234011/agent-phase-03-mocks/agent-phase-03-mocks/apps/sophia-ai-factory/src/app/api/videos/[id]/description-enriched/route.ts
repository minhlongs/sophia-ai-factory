/**
 * GET /api/videos/{id}/description-enriched
 *
 * Delivers the homepage promise: "Affiliate Program Discovery — manage your
 * affiliate IDs to embed into video descriptions." Returns a description
 * string built from the video's title (as the body) and the caller's
 * registered affiliate links.
 *
 * Optional query params:
 *   ?niche=photography  → boost niche-matching offers
 *   ?max=4              → cap the number of injected links (1..5, default 3)
 *   ?body=Hello%20world → override the body text instead of using video title
 *
 * Auth: session cookie OR OpenClaw Bearer token.
 *
 * @module app/api/videos/[id]/description-enriched
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrOpenclawBearer } from '@/seed/auth/openclaw-token';
import { createServerClient } from '@/seed/db/client';
import { buildVideoDescription } from '@/land/affiliates/video-description-injector';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUserOrOpenclawBearer(req.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const db = createServerClient();
  const { data: video } = await db
    .from('videos')
    .select('id, user_id, title')
    .eq('id', id)
    .maybeSingle() as { data: { id: string; user_id: string; title: string | null } | null };

  if (!video) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (video.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const nicheHint = searchParams.get('niche') ?? undefined;
  const bodyOverride = searchParams.get('body');
  const baseBody = bodyOverride ?? video.title ?? '';
  const maxLinks = Number(searchParams.get('max') ?? '3') || 3;

  const result = await buildVideoDescription({
    userId: user.id,
    baseBody,
    nicheHint,
    maxLinks,
  });

  return NextResponse.json({
    videoId: id,
    description: result.description,
    affiliateCount: result.affiliateCount,
    appliedNicheBoost: result.appliedNicheBoost,
    links: result.links.map((l) => ({
      offerTitle: l.offerTitle,
      code: l.code,
      subId: l.subId,
    })),
  });
}
