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
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  verifyTikTokSignature,
  ingestTikTokPerformanceEvent,
  type TikTokWebhookEvent,
} from './tiktok-webhook-helpers';

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

    const db = createServerClient();

    // Find result by channel_post_id
    const { data: resultData } = await db
      .from('publishing_results')
      .select('id, tenant_id, metrics_json')
      .eq('channel_post_id', publishId)
      .maybeSingle();

    if (!resultData) {
      logger.info('[tiktok-notification] No result found for publishId', { publishId });
      return NextResponse.json({ ok: true });
    }

    const result = resultData as { id: number; tenant_id: string; metrics_json: string | null };
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
      .update({
        metrics_json: JSON.stringify(merged),
        recorded_at: Math.floor(Date.now() / 1000),
      })
      .eq('id', result.id);

    if (stats) {
      await ingestTikTokPerformanceEvent(publishId, result.tenant_id, merged);
    }

    logger.info('[tiktok-notification] Metrics updated', { publishId, resultId: result.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error(
      '[tiktok-notification] Error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
