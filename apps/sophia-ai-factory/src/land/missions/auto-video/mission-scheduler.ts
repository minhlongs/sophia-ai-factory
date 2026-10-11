/**
 * Auto Video Mission Scheduler & Video Render Handler
 *
 * Layer: land
 *
 * @module land/missions/auto-video/mission-scheduler
 */

import { schedulePublish, PublishConfigurationError } from '@/land/publish/schedule-video-publish';
import { submitByokVideo, RenderByokVideoError } from '@/land/video/generation/render-byok-video';
import { logger } from '@/seed/utils/logger-utility';
import { AutoVideoMissionError, type AutoVideoMissionInput, type AutoVideoMissionResult } from './types';

/**
 * Step 4: Optional HeyGen video render submit.
 */
export async function submitMissionVideo(
  input: AutoVideoMissionInput,
  scriptText: string,
  title: string,
  missionId: string,
): Promise<AutoVideoMissionResult['video']> {
  try {
    const submit = await submitByokVideo({
      userId: input.userId,
      script: scriptText,
      title,
    });
    return {
      videoId: submit.videoId,
      heygenJobId: submit.heygenJobId,
      status: submit.status,
      ...(submit.videoUrl ? { videoUrl: submit.videoUrl } : {}),
    };
  } catch (err) {
    if (err instanceof RenderByokVideoError && err.code === 'BYOK_REQUIRED') {
      logger.info('[auto-video-mission] HeyGen render skipped (no BYOK key)', { missionId });
      return undefined;
    }
    const msg = err instanceof Error ? err.message : 'video submit failed';
    throw new AutoVideoMissionError('VIDEO_RENDER_FAILED', msg, missionId);
  }
}

/**
 * Step 5: Optional publish schedule.
 */
export async function scheduleMissionPublish(
  input: AutoVideoMissionInput,
  videoResult: AutoVideoMissionResult['video'],
  caption: string,
  missionId: string,
): Promise<AutoVideoMissionResult['publish']> {
  if (!input.channelId) {
    return undefined;
  }

  const realVideoId = videoResult?.videoId;
  if (!realVideoId) {
    // Soft-skip: no video row yet because HeyGen BYOK was not configured.
    logger.info('[auto-video-mission] publish skipped — no video row (no BYOK key)', { missionId });
    return { skipped: true, reason: 'no_byok' };
  }

  const scheduledAt = input.scheduledAt ?? Math.floor(Date.now() / 1000) + 3600;
  try {
    const sch = await schedulePublish({
      userId: input.userId,
      videoId: realVideoId,
      channelId: input.channelId,
      scheduledAt,
      caption,
    });
    return { jobId: sch.jobId, scheduledAt: sch.scheduledAt };
  } catch (err) {
    const isMissingVideo = err instanceof PublishConfigurationError && err.code === 'VIDEO_NOT_FOUND';
    logger.warn('[auto-video-mission] schedule step failed', {
      missionId,
      reason: isMissingVideo ? 'video_row_not_created_yet' : 'unknown',
    });
    return undefined;
  }
}
