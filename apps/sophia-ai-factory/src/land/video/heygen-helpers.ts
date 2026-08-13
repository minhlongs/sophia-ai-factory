/**
 * HeyGen API Helpers
 *
 * Provides functions for creating AI avatar videos via HeyGen API.
 */

import { logger } from '@/seed/utils/logger-utility'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'

export interface CreateHeyGenVideoParams {
  apiKey: string;
  script: string;
  title: string;
}

export interface CreateHeyGenVideoResult {
  videoId: string;
}

const HEYGEN_VIDEO_URL = 'https://api.heygen.com/v2/video/generate'

export async function createHeyGenVideo(params: CreateHeyGenVideoParams): Promise<CreateHeyGenVideoResult> {
  const { apiKey, script, title } = params;

  if (!apiKey) {
    throw new Error('HeyGen API key is required');
  }

  // Circuit breaker: check if HeyGen is available before fetch
  if (!shouldAllowRequest('heygen')) {
    throw new Error('Circuit breaker open for HeyGen — too many failures');
  }

  try {
    // HeyGen video generation request
    // Using avatar video generation endpoint
    const response = await fetch(HEYGEN_VIDEO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        title,
        script,
        // Default avatar and voice - can be made configurable later
        avatar_id: process.env.HEYGEN_DEFAULT_AVATAR_ID,
        voice_id: process.env.HEYGEN_DEFAULT_VOICE_ID,
        // Optional: add more configuration as needed
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch((err) => {
        logger.warn('Failed to read HeyGen response body', { error: String(err), context: 'createHeyGenVideo' });
        return '';
      });
      const kind = classifyError(new Error(`HTTP ${response.status}`))
      recordFailure('heygen', kind)
      throw new Error(`HeyGen video creation failed: HTTP ${response.status} — ${body.slice(0, 200)}`);
    }

    const data = await response.json() as { data?: { video_id?: string }; video_id?: string };

    // HeyGen returns video_id in the response
    const videoId = data.data?.video_id || data.video_id;

    if (!videoId) {
      throw new Error('HeyGen response did not contain video_id');
    }

    // Circuit breaker: record success
    recordSuccess('heygen')
    logger.info('[heygen-helpers] Video created', { videoId, title });

    return { videoId }
  } catch (err) {
    // Circuit breaker: classify and record failure for all errors
    const kind = classifyError(err)
    recordFailure('heygen', kind)
    logger.error('[heygen-helpers] createHeyGenVideo exception', err instanceof Error ? err : undefined)
    throw err
  }
}