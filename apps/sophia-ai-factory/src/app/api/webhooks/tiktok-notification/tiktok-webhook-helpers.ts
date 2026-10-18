/**
 * Signature verification and performance event ingestion for TikTok webhook.
 * @module app/api/webhooks/tiktok-notification/tiktok-webhook-helpers
 */

import { logger } from '@/seed/utils/logger-utility';

export interface TikTokWebhookEvent {
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

export async function verifyTikTokSignature(request: Request, body: string): Promise<boolean> {
  const secret = process.env.TIKTOK_WEBHOOK_SECRET;
  // H6: fail-closed in production — accept unsigned only in dev/test
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    logger.warn(
      '[tiktok-notification] TIKTOK_WEBHOOK_SECRET not set — skipping signature check (dev only)',
    );
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
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison
  if (signature.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

export async function ingestTikTokPerformanceEvent(
  publishId: string,
  tenantId: string,
  merged: { views: unknown; likes: unknown; comments: unknown; shares: unknown },
): Promise<void> {
  try {
    const { recordPerformanceEventIdempotent } = await import('@/tree/performance/events');
    const today = new Date().toISOString().slice(0, 10);
    await recordPerformanceEventIdempotent({
      id: `pevt_tt_${publishId}_${today}`,
      workspaceId: tenantId || 'sophia-global',
      assetId: publishId,
      projectId: publishId,
      entityType: 'video',
      entityId: publishId,
      channel: 'tiktok',
      eventType: 'engagement',
      count: Number(merged.views),
      valueCents: 0,
      recordedAt: Date.now(),
      rawData: {
        views: merged.views,
        likes: merged.likes,
        comments: merged.comments,
        shares: merged.shares,
        source: 'tiktok-webhook',
      },
    });
  } catch (evtErr) {
    logger.warn('[tiktok-notification] Failed to record performance event (non-fatal)', {
      publishId,
      error: String(evtErr),
    });
  }
}
