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
import type { VideoRenderProviderInput, VideoRenderProviderResult } from './video-render-provider';

export interface Wav2LipConfig {
  /** Fully qualified URL of the self-hosted Wav2Lip instance (e.g. https://wav2lip.example.com) */
  apiUrl: string;
}

/**
 * Additional parameters Wav2Lip accepts beyond the standard input.
 */
export interface Wav2LipVideoOptions {
  /** URL or base64 of the target video for lip-sync. If absent, provider uses avatar_id. */
  targetVideoUrl?: string;
  /** URL or base64 of the audio source. If absent, provider uses voice_id to generate. */
  audioUrl?: string;
  /** Padding of the face detection box [top, bottom, left, right] */
  pad?: [number, number, number, number];
  /** Resize factor for the face detection (0 = no resize) */
  resizeFactor?: number;
  /** Whether to use the more accurate Wav2Lip GAN model */
  useGan?: boolean;
}

export type Wav2LipInput = VideoRenderProviderInput & Wav2LipVideoOptions;

export interface Wav2LipApiResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  job_id: string;
  video_url?: string;
  error?: string;
}

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

  const body: Record<string, unknown> = {
    script: input.script,
    title: input.title ?? undefined,
    voice_id: input.voiceId ?? undefined,
    avatar_id: input.avatarId ?? undefined,
    callback_url: input.callbackUrl ?? undefined,
  };

  // Pass through Wav2Lip-specific options
  if (input.targetVideoUrl) body.target_video_url = input.targetVideoUrl;
  if (input.audioUrl) body.audio_url = input.audioUrl;
  if (input.pad) body.pad = input.pad;
  if (input.resizeFactor !== undefined) body.resize_factor = input.resizeFactor;
  if (input.useGan !== undefined) body.use_gan = input.useGan;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000), // 30s timeout for submission
    });
  } catch (err) {
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

export class Wav2LipProviderError extends Error {
  code: 'CONNECTION_FAILED' | 'INVALID_RESPONSE' | 'SUBMIT_FAILED';

  constructor(code: Wav2LipProviderError['code'], message: string) {
    super(message);
    this.name = 'Wav2LipProviderError';
    this.code = code;
  }
}
