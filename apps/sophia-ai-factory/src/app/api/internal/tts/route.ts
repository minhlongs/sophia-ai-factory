/**
 * Internal TTS Proxy
 *
 * POST /api/internal/tts
 * Auth: x-internal-token header validated against COQUI_INTERNAL_TOKEN env var.
 *
 * - If COQUI_FLY_URL is not set → returns a mock 1-sec silent WAV (dev mode).
 * - If jobId's audio_r2_key already set → returns cached key (idempotent).
 * - Fetches from Coqui FastAPI /synth, streams WAV to R2, returns metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVideoBucket, tenantScopedKey } from '@/land/video/storage/r2-binding';
import { uploadToR2 } from '@/land/video/storage/r2-multipart-upload';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  CIRCUIT_SERVICE,
  bodySchema,
  verifyInternalToken,
} from './tts-route-helpers';
import {
  checkCachedOrMockTts,
  resolveVoiceAndLanguage,
} from './tts-precheck';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyInternalToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Reject when TTS provider is not configured (prevents silent mock fallback in production)
  const coquiUrl = process.env.COQUI_FLY_URL;
  if (!coquiUrl) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('[TTS] COQUI_FLY_URL not set — returning mock WAV', { jobId: 'unknown' });
    } else {
      logger.error('[TTS] COQUI_FLY_URL not set — rejecting production request (500)');
      return NextResponse.json(
        { error: 'TTS provider not configured', detail: 'COQUI_FLY_URL env var is missing' },
        { status: 500 },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { text, voiceId, voicePresetId, language: rawLanguage, tenantId, jobId } = parsed.data;

  const voiceResolution = resolveVoiceAndLanguage({ voiceId, voicePresetId, rawLanguage });
  if (!voiceResolution.ok) {
    return voiceResolution.response;
  }
  const { resolvedVoiceRef, resolvedLanguage } = voiceResolution;

  const r2Key = tenantScopedKey(tenantId, jobId, 'audio.wav');
  const earlyResponse = await checkCachedOrMockTts({ jobId, tenantId, r2Key, coquiUrl });
  if (earlyResponse) {
    return earlyResponse;
  }

  // Fetch from Coqui XTTS v2
  try {
    if (!shouldAllowRequest(CIRCUIT_SERVICE)) {
      throw new Error(`[circuit-breaker] Circuit open for ${CIRCUIT_SERVICE}`);
    }

    const coquiResp = await fetch(`${coquiUrl}/synth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_ref_url: resolvedVoiceRef, language: resolvedLanguage }),
    });

    if (!coquiResp.ok) {
      const kind = classifyHttpStatus(coquiResp.status);
      recordFailure(CIRCUIT_SERVICE, kind);
      const errText = await coquiResp.text().catch((err) => {
        logger.warn('Failed to read response text', { error: String(err), context: 'ttsInternal' });
        return 'unknown';
      });
      logger.warn('[TTS] Coqui error', { status: coquiResp.status, errText, jobId });
      return NextResponse.json({ error: `Coqui TTS failed: ${coquiResp.status}` }, { status: 502 });
    }

    const durationSec = Number(coquiResp.headers.get('x-duration-sec') ?? '0');
    const wavBuffer = await coquiResp.arrayBuffer();
    recordSuccess(CIRCUIT_SERVICE);

    const bucketRef = await getVideoBucket();
    if (!bucketRef) {
      return NextResponse.json({ error: 'R2 bucket unavailable' }, { status: 503 });
    }

    await uploadToR2({ bucket: bucketRef.bucket, key: r2Key, data: wavBuffer });

    logger.info('[TTS] Synthesis complete', { jobId, r2Key, durationSec });
    return NextResponse.json({ r2Key, durationSec, costUsd: 0 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('[circuit-breaker]')) throw err;
    const kind = classifyError(err);
    recordFailure(CIRCUIT_SERVICE, kind);
    logger.warn('[TTS] Unexpected error', { jobId, error: String(err) });
    return NextResponse.json({ error: 'Internal TTS error' }, { status: 500 });
  }
}
