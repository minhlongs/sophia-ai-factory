/**
 * HeyGen Webhook Receiver
 *
 * Receives video status push events from HeyGen, verifies HMAC-SHA256
 * signature, and updates the corresponding `videos` row in D1.
 *
 * Configure HeyGen dashboard webhook → POST https://sophia.agencyos.network/api/webhooks/heygen
 * Secret: env HEYGEN_WEBHOOK_SECRET (CF Worker secret).
 *
 * Note: HeyGen webhook payload schema is not publicly documented; this
 * handler accepts a flexible shape ({video_id, status, video_url, ...})
 * and ignores unknown event types. Always returns 200 after sig check
 * to prevent retry storms.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

const HEYGEN_WEBHOOK_SECRET = process.env.HEYGEN_WEBHOOK_SECRET;
const TERMINAL = new Set(['completed', 'failed', 'success', 'error']);

interface HeyGenWebhookPayload {
  event_type?: string;
  video_id?: string;
  status?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}

async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

function normalizeStatus(raw?: string): 'completed' | 'failed' | 'processing' {
  if (!raw) return 'processing';
  const s = raw.toLowerCase();
  if (s === 'success' || s === 'completed') return 'completed';
  if (s === 'error' || s === 'failed') return 'failed';
  return 'processing';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!HEYGEN_WEBHOOK_SECRET) {
    // Return 200 to avoid HeyGen retry storm. Cron polling handles status updates.
    logger.warn('[heygen-webhook] HEYGEN_WEBHOOK_SECRET not configured — relying on cron polling');
    return NextResponse.json({ ok: true, mode: 'cron-poll-fallback' });
  }

  const rawBody = await req.text();
  const sig =
    req.headers.get('x-heygen-signature') ??
    req.headers.get('heygen-signature') ??
    '';

  if (!sig) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 401 });
  }
  const valid = await verifySignature(rawBody, sig, HEYGEN_WEBHOOK_SECRET);
  if (!valid) {
    logger.warn('[heygen-webhook] invalid signature');
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: HeyGenWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as HeyGenWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const videoId = payload.video_id;
  if (!videoId) {
    logger.warn('[heygen-webhook] payload missing video_id', { event_type: payload.event_type });
    return NextResponse.json({ ok: true, ignored: 'no_video_id' });
  }

  const status = normalizeStatus(payload.status);
  if (!TERMINAL.has(status)) {
    return NextResponse.json({ ok: true, ignored: 'non_terminal' });
  }

  try {
    const db = createServerClient();
    await db
      .from('videos')
      .update({
        status,
        video_url: payload.video_url ?? null,
        thumbnail_url: payload.thumbnail_url ?? null,
        duration_sec: typeof payload.duration === 'number' ? payload.duration : null,
        error: payload.error ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('heygen_job_id', videoId);
    logger.info('[heygen-webhook] video updated', { videoId, status });
  } catch (err) {
    logger.error('[heygen-webhook] D1 update failed', err instanceof Error ? err : undefined, { videoId });
  }

  return NextResponse.json({ ok: true });
}
