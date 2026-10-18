/**
 * Visual generation providers for the video pipeline.
 *
 * Each provider initiates a job and polls until completion.
 * Sleep is injected via callback so the module stays framework-agnostic.
 *
 * @module forest/inngest/functions/video-generate-visual
 */

import { logger } from '@/seed/utils/logger-utility';
// eslint-disable-next-line no-restricted-imports -- forest→land orchestration: video generation service clients
import { getHeyGenClient } from '@/land/heygen/heygen-client';
import { POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS } from './video-generate-helpers';
import {
  type VisualProviderResult,
  type SleepFn,
  pollDidVideo,
  pollWanVideo,
} from './video-generate-visual-providers';

export {
  type VisualProviderResult,
  type SleepFn,
  pollDidVideo,
  pollWanVideo,
};

// ── HeyGen ────────────────────────────────────────────────────────────────

export async function pollHeyGenVideo(
  userId: string,
  prompt: string,
  missionId: string,
  sleep: SleepFn,
): Promise<VisualProviderResult> {
  const heygenClient = await getHeyGenClient(userId);
  if (!heygenClient) return { videoUrl: null, provider: 'heygen' };

  try {
    const videoId = await heygenClient.createVideo({
      avatarId: 'Daisy-inskirt-20220818',
      voiceId: 'en-US-JennyNeural',
      script: prompt,
      title: missionId,
    });

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await sleep(`heygen-poll-${attempt}`, POLL_INTERVAL_MS);
      const status = await heygenClient.getVideoStatus(videoId);
      if (status.status === 'completed' && status.video_url) {
        return { videoUrl: status.video_url, provider: 'heygen' };
      }
      if (status.status === 'failed') {
        logger.warn('[videoGenerate] HeyGen video failed', { videoId, error: status.error });
        break;
      }
    }
  } catch (err) {
    logger.warn('[videoGenerate] HeyGen creation or polling error', { error: err });
  }

  return { videoUrl: null, provider: 'heygen' };
}
