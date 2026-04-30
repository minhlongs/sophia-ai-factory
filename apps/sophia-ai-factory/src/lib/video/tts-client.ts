/**
 * TTS Client
 *
 * Typed wrapper for calling /api/internal/tts from Inngest steps.
 * Handles mock fallback when COQUI_FLY_URL is absent.
 */

import { logger } from '@/lib/utils/logger-utility';

export interface TTSSynthesizeParams {
  text: string;
  voiceId?: string;
  language: string;
  tenantId: string;
  jobId: string;
  /** Base URL of the Next.js worker (e.g. https://sophia.agencyos.network) */
  baseUrl: string;
  /** Internal token for x-internal-token header */
  internalToken: string;
}

export interface TTSSynthesizeResult {
  r2Key: string;
  durationSec: number;
  costUsd: number;
}

/**
 * Call /api/internal/tts and return R2 key + cost metadata.
 * Throws on non-2xx response.
 */
export async function synthesize(params: TTSSynthesizeParams): Promise<TTSSynthesizeResult> {
  const { text, voiceId, language, tenantId, jobId, baseUrl, internalToken } = params;

  const url = `${baseUrl}/api/internal/tts`;

  logger.info('[TTSClient] Calling internal TTS', { jobId, tenantId, language });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-token': internalToken,
    },
    body: JSON.stringify({ text, voiceId, language, tenantId, jobId }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`[TTSClient] /api/internal/tts returned ${response.status}: ${errorText}`);
  }

  const result = (await response.json()) as TTSSynthesizeResult;

  logger.info('[TTSClient] TTS complete', { jobId, r2Key: result.r2Key, durationSec: result.durationSec });
  return result;
}
