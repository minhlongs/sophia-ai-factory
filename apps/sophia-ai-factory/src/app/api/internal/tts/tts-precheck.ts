/**
 * Voice preset resolution, idempotency check, and dev mock fallback for /api/internal/tts.
 * @module app/api/internal/tts/tts-precheck
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { uploadToR2 } from '@/land/video/storage/r2-multipart-upload';
import { logger } from '@/seed/utils/logger-utility';
import { getVoicePreset } from '@/seed/voices/presets';
import { SILENT_WAV_B64, type VideoJobRow } from './tts-route-helpers';

export function resolveVoiceAndLanguage(params: {
  voiceId?: string;
  voicePresetId?: string;
  rawLanguage?: string;
}):
  | { ok: true; resolvedVoiceRef: string | null; resolvedLanguage: string }
  | { ok: false; response: NextResponse } {
  let resolvedVoiceRef: string | null = params.voiceId ?? null;
  let resolvedLanguage = params.rawLanguage ?? 'en';

  if (params.voicePresetId) {
    const preset = getVoicePreset(params.voicePresetId);
    if (!preset) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Unknown voicePresetId: ${params.voicePresetId}` },
          { status: 400 },
        ),
      };
    }
    resolvedVoiceRef = preset.coquiSpeaker;
    if (!params.rawLanguage) resolvedLanguage = preset.language;
  }

  return { ok: true, resolvedVoiceRef, resolvedLanguage };
}

export async function checkCachedOrMockTts(params: {
  jobId: string;
  tenantId: string;
  r2Key: string;
  coquiUrl?: string;
}): Promise<NextResponse | null> {
  const { jobId, tenantId, r2Key, coquiUrl } = params;

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

  if (!coquiUrl) {
    logger.warn('[TTS] COQUI_FLY_URL not set — returning mock WAV', { jobId });
    const wavBuffer = Buffer.from(SILENT_WAV_B64, 'base64');

    const bucketRef = await getVideoBucket();
    if (bucketRef) {
      await uploadToR2({ bucket: bucketRef.bucket, key: r2Key, data: wavBuffer.buffer });
    }

    return NextResponse.json({ r2Key, durationSec: 1, costUsd: 0, mock: true });
  }

  return null;
}
