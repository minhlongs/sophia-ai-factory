/**
 * Validation schema, constant fixtures, and internal token auth for /api/internal/tts.
 * @module app/api/internal/tts/tts-route-helpers
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';

export const CIRCUIT_SERVICE = 'tts-coqui' as const;

// 1-second silent WAV (44 bytes: RIFF header + empty data chunk)
export const SILENT_WAV_B64 =
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export const bodySchema = z.object({
  text: z.string().min(1).max(10000),
  /** Custom Coqui speaker reference (BYOV / ref-audio URL). Mutually exclusive with voicePresetId. */
  voiceId: z.string().optional(),
  /** Stable preset ID from VOICE_PRESETS (e.g. 'alex-en-m'). Resolved server-side. */
  voicePresetId: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  tenantId: z.string().min(1),
  jobId: z.string().min(1),
});

export interface VideoJobRow {
  audio_r2_key: string | null;
}

function timingSafeCompare(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < maxLen; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export function verifyInternalToken(request: NextRequest): boolean {
  const expected = process.env.COQUI_INTERNAL_TOKEN;
  if (!expected) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('[TTS] COQUI_INTERNAL_TOKEN not set — allowing non-production dev mode');
      return true;
    }
    logger.error('[TTS] COQUI_INTERNAL_TOKEN not set — rejecting production request');
    return false;
  }
  const provided = request.headers.get('x-internal-token') ?? '';
  return timingSafeCompare(provided, expected);
}
