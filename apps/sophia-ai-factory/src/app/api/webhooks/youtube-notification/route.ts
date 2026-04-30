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
import { getD1Client } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

async function verifyHmac(request: Request, body: string): Promise<boolean> {
  const secret = process.env.YOUTUBE_WEBHOOK_SECRET;
  if (!secret) return true; // Dev/test: skip verification

  const signature = request.headers.get('x-hub-signature-256') ?? '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expectedHex = `sha256=${Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('')}`;

  // Timing-safe comparison
  if (signature.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

interface YouTubeWebhookPayload {
  videoId?: string;
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

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

    const db = await getD1Client();

    // Find the publishing_result by channel_post_id = videoId
    const { data: resultData } = await db
      .from('publishing_results')
      .select('id, metrics_json')
      .eq('channel_post_id', videoId)
      .maybeSingle();

    if (!resultData) {
      logger.info('[youtube-notification] No result found for videoId', { videoId });
      return NextResponse.json({ ok: true });
    }

    const result = resultData as { id: number; metrics_json: string | null };
    const existing = result.metrics_json ? JSON.parse(result.metrics_json) as Record<string, unknown> : {};

    const merged = {
      ...existing,
      views: Number(payload.statistics?.viewCount ?? existing['views'] ?? 0),
      likes: Number(payload.statistics?.likeCount ?? existing['likes'] ?? 0),
      comments: Number(payload.statistics?.commentCount ?? existing['comments'] ?? 0),
      updated_at: Math.floor(Date.now() / 1000),
    };

    await db
      .from('publishing_results')
      .update({ metrics_json: JSON.stringify(merged), recorded_at: Math.floor(Date.now() / 1000) })
      .eq('id', result.id);

    logger.info('[youtube-notification] Metrics updated', { videoId, resultId: result.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[youtube-notification] Error', err instanceof Error ? err : new Error(String(err)));
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
