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
import { z } from 'zod';
import { createServerClient } from '@/seed/db/client';
import { getVideoBucket } from '@/lib/video/r2-binding';
import { tenantScopedKey } from '@/lib/video/r2-binding';
import { uploadToR2 } from '@/lib/video/r2-multipart-upload';
import { logger } from '@/seed/utils/logger-utility';
import { getVoicePreset } from '@/seed/voices/presets';

// 1-second silent WAV (44 bytes: RIFF header + empty data chunk)
const SILENT_WAV_B64 =
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

const bodySchema = z.object({
  text: z.string().min(1).max(10000),
  /** Custom Coqui speaker reference (BYOV / ref-audio URL). Mutually exclusive with voicePresetId. */
  voiceId: z.string().optional(),
  /** Stable preset ID from VOICE_PRESETS (e.g. 'alex-en-m'). Resolved server-side. */
  voicePresetId: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  tenantId: z.string().min(1),
  jobId: z.string().min(1),
});

function timingSafeCompare(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < maxLen; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

function verifyInternalToken(request: NextRequest): boolean {
  const expected = process.env.COQUI_INTERNAL_TOKEN;
  if (!expected) {
    // Dev fallback: allow through with warning
    logger.warn('[TTS] COQUI_INTERNAL_TOKEN not set — running in dev mode');
    return true;
  }
  const provided = request.headers.get('x-internal-token') ?? '';
  return timingSafeCompare(provided, expected);
}

interface VideoJobRow {
  audio_r2_key: string | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyInternalToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  // Resolve preset → coqui speaker + default language. Preset wins over raw voiceId.
  let resolvedVoiceRef: string | null = voiceId ?? null;
  let resolvedLanguage = rawLanguage ?? 'en';
  if (voicePresetId) {
    const preset = getVoicePreset(voicePresetId);
    if (!preset) {
      return NextResponse.json(
        { error: `Unknown voicePresetId: ${voicePresetId}` },
        { status: 400 },
      );
    }
    resolvedVoiceRef = preset.coquiSpeaker;
    if (!rawLanguage) resolvedLanguage = preset.language;
  }

  // Idempotency: check if audio_r2_key already set
  const db = createServerClient();
  const { data: existing } = await db
    .from('video_jobs')
    .select('audio_r2_key')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .single();

  const existingRow = existing as VideoJobRow | null;
  if (existingRow?.audio_r2_key) {
    logger.info('[TTS] Returning cached audio', { jobId, r2Key: existingRow.audio_r2_key });
    return NextResponse.json({
      r2Key: existingRow.audio_r2_key,
      durationSec: 0,
      costUsd: 0,
      cached: true,
    });
  }

  const coquiUrl = process.env.COQUI_FLY_URL;
  const r2Key = tenantScopedKey(tenantId, jobId, 'audio.wav');

  if (!coquiUrl) {
    // Dev mock: return silent 1-sec WAV
    logger.warn('[TTS] COQUI_FLY_URL not set — returning mock WAV', { jobId });
    const wavBuffer = Buffer.from(SILENT_WAV_B64, 'base64');

    const bucketRef = await getVideoBucket();
    if (bucketRef) {
      await uploadToR2({ bucket: bucketRef.bucket, key: r2Key, data: wavBuffer.buffer });
    }

    return NextResponse.json({ r2Key, durationSec: 1, costUsd: 0, mock: true });
  }

  // Fetch from Coqui XTTS v2
  try {
    const coquiResp = await fetch(`${coquiUrl}/synth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_ref_url: resolvedVoiceRef, language: resolvedLanguage }),
    });

    if (!coquiResp.ok) {
      const errText = await coquiResp.text().catch(() => 'unknown');
      logger.warn('[TTS] Coqui error', { status: coquiResp.status, errText, jobId });
      return NextResponse.json(
        { error: `Coqui TTS failed: ${coquiResp.status}` },
        { status: 502 },
      );
    }

    const durationSec = Number(coquiResp.headers.get('x-duration-sec') ?? '0');
    const wavBuffer = await coquiResp.arrayBuffer();

    const bucketRef = await getVideoBucket();
    if (!bucketRef) {
      return NextResponse.json({ error: 'R2 bucket unavailable' }, { status: 503 });
    }

    await uploadToR2({ bucket: bucketRef.bucket, key: r2Key, data: wavBuffer });

    logger.info('[TTS] Synthesis complete', { jobId, r2Key, durationSec });
    return NextResponse.json({ r2Key, durationSec, costUsd: 0 });
  } catch (err) {
    logger.warn('[TTS] Unexpected error', { jobId, error: String(err) });
    return NextResponse.json({ error: 'Internal TTS error' }, { status: 500 });
  }
}
