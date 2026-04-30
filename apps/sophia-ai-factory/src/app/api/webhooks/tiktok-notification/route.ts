/**
 * POST /api/webhooks/tiktok-notification
 *
 * Receives TikTok webhook events for video publish status updates.
 * Verifies HMAC-SHA256 signature via X-TikTok-Signature header.
 * Updates publishing_results.metrics_json on engagement events.
 *
 * Required env var: TIKTOK_WEBHOOK_SECRET
 */

import { NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

async function verifyTikTokSignature(request: Request, body: string): Promise<boolean> {
  const secret = process.env.TIKTOK_WEBHOOK_SECRET;
  // H6: fail-closed in production — accept unsigned only in dev/test
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    logger.warn('[tiktok-notification] TIKTOK_WEBHOOK_SECRET not set — skipping signature check (dev only)');
    return true;
  }

  const signature = request.headers.get('x-tiktok-signature') ?? '';
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expectedHex = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison
  if (signature.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

interface TikTokWebhookEvent {
  event?: string;
  data?: {
    publish_id?: string;
    video_id?: string;
    status?: string;
    statistics?: {
      play_count?: number;
      like_count?: number;
      comment_count?: number;
      share_count?: number;
    };
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.text();

    const valid = await verifyTikTokSignature(request, body);
    if (!valid) {
      logger.warn('[tiktok-notification] Invalid HMAC signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body) as TikTokWebhookEvent;
    const publishId = payload.data?.publish_id ?? payload.data?.video_id;

    if (!publishId) {
      return NextResponse.json({ ok: true }); // Ignore unrecognized events
    }

    const db = await getD1Client();

    // Find result by channel_post_id
    const { data: resultData } = await db
      .from('publishing_results')
      .select('id, metrics_json')
      .eq('channel_post_id', publishId)
      .maybeSingle();

    if (!resultData) {
      logger.info('[tiktok-notification] No result found for publishId', { publishId });
      return NextResponse.json({ ok: true });
    }

    const result = resultData as { id: number; metrics_json: string | null };
    const existing = result.metrics_json
      ? (JSON.parse(result.metrics_json) as Record<string, unknown>)
      : {};

    const stats = payload.data?.statistics;
    const merged = {
      ...existing,
      views: stats?.play_count ?? existing['views'] ?? 0,
      likes: stats?.like_count ?? existing['likes'] ?? 0,
      comments: stats?.comment_count ?? existing['comments'] ?? 0,
      shares: stats?.share_count ?? existing['shares'] ?? 0,
      tiktok_status: payload.data?.status ?? existing['tiktok_status'],
      updated_at: Math.floor(Date.now() / 1000),
    };

    await db
      .from('publishing_results')
      .update({ metrics_json: JSON.stringify(merged), recorded_at: Math.floor(Date.now() / 1000) })
      .eq('id', result.id);

    logger.info('[tiktok-notification] Metrics updated', { publishId, resultId: result.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[tiktok-notification] Error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
