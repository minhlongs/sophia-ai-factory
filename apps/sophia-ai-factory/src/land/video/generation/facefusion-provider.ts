/**
 * FaceFusion Video Provider — BYOK self-hosted wrapper.
 *
 * Calls a customer's self-hosted FaceFusion instance to render AI video
 * with face-swap or lip-sync. The API URL is customer-provided (BYOK pattern)
 * and should resolve to a running FaceFusion REST API.
 *
 * Requires: FaceFusion 2.x+ with REST API enabled.
 *
 * @module land/video/generation/facefusion-provider
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { VideoRenderProviderInput, VideoRenderProviderResult } from './video-render-provider';

export interface FaceFusionConfig {
  /** Fully qualified URL of the self-hosted FaceFusion instance (e.g. https://facefusion.example.com) */
  apiUrl: string;
  /** Optional API key if the instance requires authentication */
  apiKey?: string;
}

/**
 * Additional parameters FaceFusion accepts beyond the standard input.
 */
export interface FaceFusionVideoOptions {
  /** Source face image URL or base64 data for face-swap */
  sourceFace?: string;
  /** Target video URL for lip-sync (overrides avatar-based generation) */
  targetVideo?: string;
  /** Specific FaceFusion job mode: 'face_swap' | 'lip_sync' | 'full' */
  mode?: 'face_swap' | 'lip_sync' | 'full';
}

export type FaceFusionInput = VideoRenderProviderInput & FaceFusionVideoOptions;

export interface FaceFusionApiResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  job_id: string;
  video_url?: string;
  error?: string;
}

/**
 * Submit a video render job to a self-hosted FaceFusion instance.
 *
 * The customer provides their own FaceFusion API URL — Sophia never hosts
 * or manages the inference infrastructure.
 *
 * @param input - Standard render input plus FaceFusion-specific options
 * @param config - Connection configuration for the self-hosted instance
 * @returns Provider result in the standardised format
 */
export async function renderWithFaceFusion(
  input: FaceFusionInput,
  config: FaceFusionConfig,
): Promise<VideoRenderProviderResult> {
  const { apiUrl, apiKey } = config;
  const endpoint = `${apiUrl.replace(/\/+$/, '')}/api/video`;

  const body: Record<string, unknown> = {
    script: input.script,
    title: input.title ?? undefined,
    voice_id: input.voiceId ?? undefined,
    avatar_id: input.avatarId ?? undefined,
    callback_url: input.callbackUrl ?? undefined,
  };

  // Pass through FaceFusion-specific options
  if (input.sourceFace) body.source_face = input.sourceFace;
  if (input.targetVideo) body.target_video = input.targetVideo;
  if (input.mode) body.mode = input.mode;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['X-API-Key'] = apiKey;

  if (!shouldAllowRequest('facefusion')) {
    logger.warn('[FaceFusion] Circuit breaker open for facefusion, request blocked');
    throw new FaceFusionProviderError('SUBMIT_FAILED', 'Circuit breaker open for facefusion — request blocked');
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000), // 30s timeout for submission
    });
    recordSuccess('facefusion');
  } catch (err) {
    recordFailure('facefusion', classifyError(err));
    const wrapped = toError(err);
    logger.error('[FaceFusion] Network error submitting video job', wrapped, {
      apiUrl,
      userId: input.userId,
    });
    throw new FaceFusionProviderError(
      'CONNECTION_FAILED',
      `FaceFusion instance unreachable at ${apiUrl}: ${wrapped.message}`,
    );
  }

  let data: FaceFusionApiResponse;
  try {
    data = (await response.json()) as FaceFusionApiResponse;
  } catch (err) {
    const wrapped = toError(err);
    logger.error('[FaceFusion] Invalid JSON response', wrapped, {
      apiUrl,
      status: response.status,
      userId: input.userId,
    });
    throw new FaceFusionProviderError(
      'INVALID_RESPONSE',
      `FaceFusion returned non-JSON response (HTTP ${response.status})`,
    );
  }

  if (!response.ok || data.status === 'failed') {
    const message = data.error ?? `HTTP ${response.status}`;
    logger.error('[FaceFusion] Job submission rejected', undefined, {
      apiUrl,
      status: response.status,
      message,
      userId: input.userId,
    });
    throw new FaceFusionProviderError(
      'SUBMIT_FAILED',
      `FaceFusion rejected the request: ${message}`,
    );
  }

  return {
    providerJobId: data.job_id,
    videoId: crypto.randomUUID(),
    status: data.status === 'completed' ? 'processing' : data.status,
    provider: 'facefusion',
    videoUrl: data.video_url,
  };
}

export class FaceFusionProviderError extends Error {
  code: 'CONNECTION_FAILED' | 'INVALID_RESPONSE' | 'SUBMIT_FAILED';

  constructor(code: FaceFusionProviderError['code'], message: string) {
    super(message);
    this.name = 'FaceFusionProviderError';
    this.code = code;
  }
}
