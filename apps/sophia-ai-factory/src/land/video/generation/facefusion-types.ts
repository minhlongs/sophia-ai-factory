/**
 * FaceFusion Video Provider Types & Request Builder
 *
 * @module land/video/generation/facefusion-types
 */

import type { VideoRenderProviderInput } from './video-render-provider';

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

export class FaceFusionProviderError extends Error {
  code: 'CONNECTION_FAILED' | 'INVALID_RESPONSE' | 'SUBMIT_FAILED';

  constructor(code: FaceFusionProviderError['code'], message: string) {
    super(message);
    this.name = 'FaceFusionProviderError';
    this.code = code;
  }
}

export function buildFaceFusionRequest(
  input: FaceFusionInput,
  config: FaceFusionConfig,
): {
  endpoint: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
} {
  const { apiUrl, apiKey } = config;
  const endpoint = `${apiUrl.replace(/\/+$/, '')}/api/video`;

  const body: Record<string, unknown> = {
    script: input.script,
    title: input.title ?? undefined,
    voice_id: input.voiceId ?? undefined,
    avatar_id: input.avatarId ?? undefined,
    callback_url: input.callbackUrl ?? undefined,
  };

  if (input.sourceFace) body.source_face = input.sourceFace;
  if (input.targetVideo) body.target_video = input.targetVideo;
  if (input.mode) body.mode = input.mode;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['X-API-Key'] = apiKey;

  return { endpoint, headers, body };
}
