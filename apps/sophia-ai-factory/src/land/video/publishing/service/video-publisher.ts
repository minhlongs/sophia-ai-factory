/**
 * Video Publisher
 * Layer: land/video/publishing
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import { getDecryptedCredentials } from '@/tree/publishing/credential-manager';
import { getAdapter } from '@/tree/publishing/token-refresh-service';
import {
  createVideoPublish,
  updateVideoPublishStatus,
} from '@/seed/db/repositories/video-publishes-repo';
import type { VideoPublishInput, VideoPublishResult } from './types';
import {
  handleFeedbackCycleCreation,
  resolvePlatformAccessToken,
} from './video-publisher-helpers';

/**
 * Publish a video to a platform.
 * Consolidates credential lookup, OAuth token refresh, and platform upload.
 */
export async function publishVideo(
  input: VideoPublishInput,
  userId: string,
): Promise<VideoPublishResult> {
  try {
    const db = createServerClient();
    if (!db) throw new Error('D1 database binding not available');

    const videoCheck = await db
      .prepare('SELECT user_id FROM videos WHERE id = ?1 UNION SELECT user_id FROM engine_missions WHERE id = ?1')
      .bind(input.videoId)
      .first<{ user_id: string }>();

    if (!videoCheck || videoCheck.user_id !== userId) {
      return { success: false, error: 'Video not found or unauthorized', code: 'NOT_FOUND' };
    }

    const publish = await createVideoPublish({
      userId,
      videoId: input.videoId,
      platform: input.platform,
      metadata: JSON.stringify({
        title: input.title,
        description: input.description,
        tags: input.tags,
        privacy: input.privacy,
      }),
      scheduledAt: input.scheduledAt,
    });

    if (input.scheduledAt && new Date(input.scheduledAt) > new Date()) {
      return { success: true, publishId: publish.id };
    }

    const creds = await getDecryptedCredentials(userId, input.platform);
    if (!creds) {
      return { success: false, error: `${input.platform} not connected`, code: 'NO_CREDENTIALS' };
    }

    const adapter = getAdapter(input.platform);
    const accessToken = await resolvePlatformAccessToken(
      userId,
      input.platform,
      creds,
      adapter,
    );

    const result = await adapter.uploadVideo(accessToken, {
      videoUrl: input.videoUrl,
      title: input.title,
      description: input.description,
      tags: input.tags,
      privacy: input.privacy,
      scheduledAt: input.scheduledAt,
    });

    await updateVideoPublishStatus(publish.id, result.status, {
      platformVideoId: result.platformVideoId,
    });

    await handleFeedbackCycleCreation(input.videoId);

    return { success: true, publishId: publish.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[VideoPublishingService] publishVideo failed', {
      videoId: input.videoId,
      error: msg,
    });
    return { success: false, error: msg, code: 'INTERNAL_ERROR' };
  }
}
