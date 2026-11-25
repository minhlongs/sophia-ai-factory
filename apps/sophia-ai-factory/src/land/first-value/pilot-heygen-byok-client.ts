/**
 * Customer-isolated HeyGen BYOK client for Pilot 9:16 Avatar MP4 generation & status polling.
 *
 * Fixes upstream contract & breaker isolation:
 * 1. Submits 9:16 vertical (`720x1280`) renders to `POST https://api.heygen.com/v2/video/generate`.
 * 2. Polls `GET https://api.heygen.com/v1/video_status.get?video_id=...` (v2 `/video/:id` returns 404).
 * 3. Scopes circuit breaker per user (`byok:${userId}`) and never trips on 401/402/403 customer key/credit rejections.
 *
 * @module land/first-value/pilot-heygen-byok-client
 */

import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind';

const HEYGEN_GENERATE_URL = 'https://api.heygen.com/v2/video/generate';
const HEYGEN_STATUS_URL = 'https://api.heygen.com/v1/video_status.get';
const DEFAULT_AVATAR_ID = 'Anna_public_3_20240108';
const DEFAULT_VOICE_ID = '2d5b0e6cf36f460aa7fc47e3eee4ba54';
const PILOT_VERTICAL_DIMENSION = { width: 720, height: 1280 };

const APPROVED_HEYGEN_MEDIA_SUFFIXES = [
  'heygen.ai',
  'heygen.com',
  'cloudfront.net',
  'amazonaws.com',
] as const;

export function assertSafeHeyGenMediaUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('HEYGEN_MEDIA_URL_INVALID');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('HEYGEN_MEDIA_URL_UNSAFE_PROTOCOL');
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const allowed = APPROVED_HEYGEN_MEDIA_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (!allowed) {
    throw new Error(`HEYGEN_MEDIA_HOST_NOT_ALLOWLISTED:${host}`);
  }
  return parsed;
}

export async function submitPilotHeyGenByokVideo(input: {
  readonly userId?: string;
  readonly apiKey: string;
  readonly script: string;
  readonly title: string;
}): Promise<{ readonly videoId: string }> {
  const breakerRef = input.userId ? `byok:${input.userId}` : 'byok:pilot';
  if (!shouldAllowRequest('heygen', breakerRef)) {
    throw new Error('HEYGEN_BREAKER_OPEN');
  }

  let res: Response;
  try {
    res = await fetch(HEYGEN_GENERATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Api-Key': input.apiKey,
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: { type: 'avatar', avatar_id: DEFAULT_AVATAR_ID, avatar_style: 'normal' },
            voice: { type: 'text', input_text: input.script, voice_id: DEFAULT_VOICE_ID },
          },
        ],
        dimension: PILOT_VERTICAL_DIMENSION,
        title: input.title,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    recordFailure('heygen', FailureKind.NETWORK, breakerRef);
    throw err;
  }

  if (!res.ok) {
    if (res.status !== 401 && res.status !== 402 && res.status !== 403) {
      recordFailure('heygen', classifyHttpStatus(res.status), breakerRef);
    }
    throw new Error(`HEYGEN_SUBMIT_HTTP_${res.status}`);
  }

  recordSuccess('heygen', breakerRef);
  const json = (await res.json()) as { data?: { video_id?: string } };
  const videoId = json.data?.video_id?.trim();
  if (!videoId) {
    throw new Error('HEYGEN_MISSING_VIDEO_ID');
  }
  return { videoId };
}

export async function fetchPilotHeyGenByokStatus(input: {
  readonly userId?: string;
  readonly apiKey: string;
  readonly videoId: string;
}): Promise<{
  readonly status: 'processing' | 'completed' | 'failed';
  readonly mediaUrl?: string;
  readonly durationSec?: number;
  readonly errorMessage?: string;
}> {
  const breakerRef = input.userId ? `byok:${input.userId}` : 'byok:pilot';
  if (!shouldAllowRequest('heygen', breakerRef)) {
    throw new Error('HEYGEN_BREAKER_OPEN');
  }

  const url = `${HEYGEN_STATUS_URL}?video_id=${encodeURIComponent(input.videoId)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Api-Key': input.apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    recordFailure('heygen', FailureKind.NETWORK, breakerRef);
    throw err;
  }

  if (!res.ok) {
    if (res.status !== 401 && res.status !== 402 && res.status !== 403) {
      recordFailure('heygen', classifyHttpStatus(res.status), breakerRef);
    }
    throw new Error(`HEYGEN_STATUS_HTTP_${res.status}`);
  }

  recordSuccess('heygen', breakerRef);
  const json = (await res.json()) as {
    data?: {
      status?: string;
      video_url?: string;
      duration?: number;
      error?: { message?: string } | string | null;
    };
  };
  const rawStatus = json.data?.status;
  if (rawStatus === 'completed' && json.data?.video_url) {
    const safeUrl = assertSafeHeyGenMediaUrl(json.data.video_url).toString();
    return {
      status: 'completed',
      mediaUrl: safeUrl,
      durationSec: typeof json.data?.duration === 'number' ? json.data.duration : undefined,
    };
  }
  if (rawStatus === 'failed') {
    const errObj = json.data?.error;
    const msg =
      typeof errObj === 'string'
        ? errObj
        : typeof errObj?.message === 'string'
          ? errObj.message
          : 'HeyGen reported render failure';
    return { status: 'failed', errorMessage: msg };
  }
  return { status: 'processing' };
}
