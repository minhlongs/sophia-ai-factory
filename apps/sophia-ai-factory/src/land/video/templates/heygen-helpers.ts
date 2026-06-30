/**
 * HeyGen shared helpers — video creation + status polling
 * Used by both Inngest pipeline (video-visual) and onboarding flow.
 */

import { logger } from '@/seed/utils/logger-utility';

export const HEYGEN_API_URL = 'https://api.heygen.com/v2';

const DEFAULT_AVATAR_ID = 'Anna_public_3_20240108';
const DEFAULT_VOICE_ID = '2d5b0e6cf36f460aa7fc47e3eee4ba54';
const VIDEO_DIMENSION = { width: 1920, height: 1080 };

export interface HeyGenCreateResult {
  videoId: string;
}

export async function createHeyGenVideo(params: {
  script: string;
  title?: string;
  apiKey: string;
  avatarId?: string;
  voiceId?: string;
  /** Optional webhook callback URL. HeyGen will POST status events here. */
  callbackUrl?: string;
}): Promise<HeyGenCreateResult> {
  const { script, title, apiKey, avatarId, voiceId, callbackUrl } = params;

  const bodyPayload: Record<string, unknown> = {
    video_inputs: [{
      character: { type: 'avatar', avatar_id: avatarId ?? DEFAULT_AVATAR_ID, avatar_style: 'normal' },
      voice: { type: 'text', input_text: script, voice_id: voiceId ?? DEFAULT_VOICE_ID },
    }],
    dimension: VIDEO_DIMENSION,
    title,
  };

  if (callbackUrl) {
    bodyPayload.callback_url = callbackUrl;
  }

  const res = await fetch(`${HEYGEN_API_URL}/video/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify(bodyPayload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch((err) => {
      logger.warn('Failed to read HeyGen error response', { error: String(err), context: 'createHeyGenVideo' });
      return '';
    });
    throw new Error(`HeyGen createVideo ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json() as { data?: { video_id?: string } };
  const videoId = data.data?.video_id;
  if (!videoId) throw new Error('HeyGen: missing video_id in response');

  logger.info('[HeyGenHelpers] Video created', { videoId });
  return { videoId };
}

export async function pollHeyGenStatus(params: {
  videoId: string;
  apiKey: string;
  maxWaitMs?: number;
}): Promise<string> {
  const { videoId, apiKey, maxWaitMs = 15 * 60_000 } = params;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${HEYGEN_API_URL}/video/${videoId}`, {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`HeyGen status ${res.status}`);

    const json = await res.json() as { data?: { status?: string; video_url?: string; error?: { message?: string } } };
    const status = json.data?.status;

    if (status === 'completed' && json.data?.video_url) {
      return json.data.video_url;
    }
    if (status === 'failed') {
      const errorMsg = json.data?.error?.message ?? 'unknown';
      throw new Error(`HeyGen video failed: ${errorMsg}`);
    }

    await new Promise((r) => setTimeout(r, 10_000));
  }

  throw new Error(`HeyGen video timed out after ${maxWaitMs}ms`);
}
