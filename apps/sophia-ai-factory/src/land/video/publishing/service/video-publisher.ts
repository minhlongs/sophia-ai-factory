/**
 * Video Publisher
 * Layer: land/video/publishing
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import {
  getDecryptedCredentials,
  storeCredentials,
  getClientCredentials,
} from '@/tree/publishing/credential-manager';
import { getAdapter } from '@/tree/publishing/token-refresh-service';
import {
  createVideoPublish,
  updateVideoPublishStatus,
} from '@/seed/db/repositories/video-publishes-repo';
import { createFeedbackCycle } from '@/tree/sop/performance-feedback-engine';
import type { VideoPublishInput, VideoPublishResult } from './types';

async function handleFeedbackCycleCreation(videoId: string): Promise<void> {
  try {
    const dbForFeedback = createServerClient();
    if (!dbForFeedback) throw new Error('D1 unavailable');
    const sopExec = await dbForFeedback.prepare(
      `SELECT id, user_id, sop_template_id FROM sop_executions WHERE id = ?1 LIMIT 1`
    ).bind(videoId).first<{ id: string; user_id: string; sop_template_id: string }>();

    let executionId: string | null = null;
    let sopId: string | null = null;
    let vidUserId: string | null = null;

    if (sopExec) {
      executionId = sopExec.id;
      sopId = sopExec.sop_template_id;
      vidUserId = sopExec.user_id;
    } else {
      const campaign = await dbForFeedback.prepare(
        `SELECT id, user_id, template_id FROM campaigns WHERE id = ?1 LIMIT 1`
      ).bind(videoId).first<{ id: string; user_id: string; template_id: string }>();

      if (campaign) {
        executionId = campaign.id;
        sopId = campaign.template_id;
        vidUserId = campaign.user_id;
      }
    }

    if (executionId && sopId && vidUserId) {
      await createFeedbackCycle({
        executionId,
        sopId,
        userId: vidUserId,
        publishedAt: Math.floor(Date.now() / 1000),
      });
    }
  } catch (e) {
    logger.error('publishVideo.createFeedbackCycle_failed', {
      videoId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

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

    let accessToken = creds.accessToken;
    if (creds.isExpired && creds.refreshToken) {
      const clientCreds = await getClientCredentials(userId, input.platform);
      if (clientCreds) {
        const refreshed = await adapter.refreshToken(
          clientCreds.clientId,
          clientCreds.clientSecret,
          creds.refreshToken,
        );
        accessToken = refreshed.accessToken;
        await storeCredentials({
          userId,
          platform: input.platform,
          accessToken: refreshed.accessToken,
          expiresIn: refreshed.expiresIn,
        });
      }
    }

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
