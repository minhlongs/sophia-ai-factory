/**
 * POST /api/webhooks/youtube-notification
 *
 * Receives YouTube push notifications (PubSubHubbub / Data API webhooks).
 * Verifies HMAC signature, updates publishing_results metrics.
 *
 * Setup: Subscribe feed at https://pubsubhubbub.appspot.com with callback = this route.
 * Hub secret = env YOUTUBE_WEBHOOK_SECRET
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  verifyHmac,
  ingestYouTubePerformanceEvent,
  type YouTubeWebhookPayload,
} from './youtube-webhook-helpers';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.text();

    const valid = await verifyHmac(request, body);
    if (!valid) {
      logger.warn('[youtube-notification] Invalid HMAC signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body) as YouTubeWebhookPayload;
    const videoId = payload.videoId;

    if (!videoId) {
      return NextResponse.json({ ok: true }); // Ignore pings without videoId
    }

    const db = createServerClient();

    // Find the publishing_result by channel_post_id = videoId
    const { data: resultData } = await db
      .from('publishing_results')
      .select('id, tenant_id, metrics_json')
      .eq('channel_post_id', videoId)
      .maybeSingle();

    if (!resultData) {
      logger.info('[youtube-notification] No result found for videoId', { videoId });
      return NextResponse.json({ ok: true });
    }

    const result = resultData as { id: number; tenant_id: string; metrics_json: string | null };
    const existing = result.metrics_json
      ? (JSON.parse(result.metrics_json) as Record<string, unknown>)
      : {};

    const merged = {
      ...existing,
      views: Number(payload.statistics?.viewCount ?? existing['views'] ?? 0),
      likes: Number(payload.statistics?.likeCount ?? existing['likes'] ?? 0),
      comments: Number(payload.statistics?.commentCount ?? existing['comments'] ?? 0),
      updated_at: Math.floor(Date.now() / 1000),
    };

    await db
      .from('publishing_results')
      .update({
        metrics_json: JSON.stringify(merged),
        recorded_at: Math.floor(Date.now() / 1000),
      })
      .eq('id', result.id);

    if (payload.statistics) {
      await ingestYouTubePerformanceEvent(videoId, result.tenant_id, merged);
    }

    logger.info('[youtube-notification] Metrics updated', { videoId, resultId: result.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error(
      '[youtube-notification] Error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** YouTube hub verification: respond with hub.challenge */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const challenge = url.searchParams.get('hub.challenge');
  const mode = url.searchParams.get('hub.mode');

  if (mode === 'subscribe' && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
