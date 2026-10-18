/**
 * Wav2Lip Video Provider — BYOK self-hosted wrapper.
 *
 * Calls a customer's self-hosted Wav2Lip inference pipeline to perform
 * lip-sync on a target video using an audio source. The API URL is
 * customer-provided (BYOK pattern).
 *
 * Requires: Wav2Lip with a REST API wrapper (e.g. wav2lip-api or custom FastAPI).
 *
 * @module land/video/generation/wav2lip-provider
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { VideoRenderProviderResult } from './video-render-provider';
import {
  buildWav2LipRequestPayload,
  Wav2LipProviderError,
  type Wav2LipApiResponse,
  type Wav2LipConfig,
  type Wav2LipInput,
  type Wav2LipVideoOptions,
} from './wav2lip-provider-helpers';

export {
  Wav2LipProviderError,
  type Wav2LipApiResponse,
  type Wav2LipConfig,
  type Wav2LipInput,
  type Wav2LipVideoOptions,
};

/**
 * Submit a lip-sync video job to a self-hosted Wav2Lip pipeline.
 *
 * The customer provides their own Wav2Lip instance URL — Sophia never hosts
 * or manages the inference infrastructure.
 *
 * @param input - Standard render input plus Wav2Lip-specific options
 * @param config - Connection configuration for the self-hosted instance
 * @returns Provider result in the standardised format
 */
export async function renderWithWav2Lip(
  input: Wav2LipInput,
  config: Wav2LipConfig,
): Promise<VideoRenderProviderResult> {
  const { apiUrl } = config;
  const endpoint = `${apiUrl.replace(/\/+$/, '')}/process`;
  const body = buildWav2LipRequestPayload(input);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!shouldAllowRequest('wav2lip')) {
    logger.warn('[Wav2Lip] Circuit breaker open for wav2lip, request blocked');
    throw new Wav2LipProviderError('SUBMIT_FAILED', 'Circuit breaker open for wav2lip — request blocked');
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    recordSuccess('wav2lip');
  } catch (err) {
    recordFailure('wav2lip', classifyError(err));
    const wrapped = toError(err);
    logger.error('[Wav2Lip] Network error submitting lip-sync job', wrapped, {
      apiUrl,
      userId: input.userId,
    });
    throw new Wav2LipProviderError(
      'CONNECTION_FAILED',
      `Wav2Lip instance unreachable at ${apiUrl}: ${wrapped.message}`,
    );
  }

  let data: Wav2LipApiResponse;
  try {
    data = (await response.json()) as Wav2LipApiResponse;
  } catch (err) {
    const wrapped = toError(err);
    logger.error('[Wav2Lip] Invalid JSON response', wrapped, {
      apiUrl,
      status: response.status,
      userId: input.userId,
    });
    throw new Wav2LipProviderError(
      'INVALID_RESPONSE',
      `Wav2Lip returned non-JSON response (HTTP ${response.status})`,
    );
  }

  if (!response.ok || data.status === 'failed') {
    const message = data.error ?? `HTTP ${response.status}`;
    logger.error('[Wav2Lip] Job submission rejected', undefined, {
      apiUrl,
      status: response.status,
      message,
      userId: input.userId,
    });
    throw new Wav2LipProviderError(
      'SUBMIT_FAILED',
      `Wav2Lip rejected the request: ${message}`,
    );
  }

  return {
    providerJobId: data.job_id,
    videoId: crypto.randomUUID(),
    status: data.status === 'completed' ? 'processing' : data.status,
    provider: 'wav2lip',
    videoUrl: data.video_url,
  };
}
