/**
 * Wav2Lip Provider types, payload builder, and error class.
 *
 * @module land/video/generation/wav2lip-provider-helpers
 */

import type { VideoRenderProviderInput } from './video-render-provider';

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

export class Wav2LipProviderError extends Error {
  code: 'CONNECTION_FAILED' | 'INVALID_RESPONSE' | 'SUBMIT_FAILED';

  constructor(code: Wav2LipProviderError['code'], message: string) {
    super(message);
    this.name = 'Wav2LipProviderError';
    this.code = code;
  }
}

export function buildWav2LipRequestPayload(input: Wav2LipInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    script: input.script,
    title: input.title ?? undefined,
    voice_id: input.voiceId ?? undefined,
    avatar_id: input.avatarId ?? undefined,
    callback_url: input.callbackUrl ?? undefined,
  };

  if (input.targetVideoUrl) body.target_video_url = input.targetVideoUrl;
  if (input.audioUrl) body.audio_url = input.audioUrl;
  if (input.pad) body.pad = input.pad;
  if (input.resizeFactor !== undefined) body.resize_factor = input.resizeFactor;
  if (input.useGan !== undefined) body.use_gan = input.useGan;

  return body;
}
