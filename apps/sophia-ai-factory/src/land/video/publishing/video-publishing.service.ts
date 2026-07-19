/**
 * Video Publishing Service
 *
 * Handles video publishing to social platforms and retry logic.
 * Manages OAuth credentials, token refresh, and platform uploads.
 *
 * @module land/video/video-publishing-service
 */

import { logger } from '@/seed/utils/logger-utility';
import { getD1, createServerClient } from '@/seed/db/client';

// ─── Public Types ───────────────────────────────────────────────────────────────

export type VideoPublishInput = {
  videoId: string;
  videoUrl: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  title: string;
  description: string;
  tags?: string[];
  privacy?: 'public' | 'unlisted' | 'private';
  scheduledAt?: string;
};

export type VideoPublishResult =
  | { success: true; publishId: string }
  | { success: false; error: string; code: string };

export type VideoRetryResult =
  | { success: true; jobId: string }
  | { success: false; error: string; code: string };

// ─── Video Publishing ───────────────────────────────────────────────────────────

/**
 * Publish a video to a platform
 *
 * Consolidates credential lookup, OAuth token refresh, and platform upload.
 * Uses the existing publish-video-action logic.
 */
export async function publishVideo(
  input: VideoPublishInput,
  userId: string,
): Promise<VideoPublishResult> {
  try {
    const { getDecryptedCredentials, storeCredentials, getClientCredentials } = await import(
      '@/forest/publishing/credential-manager'
    );
    const { getAdapter } = await import('@/forest/publishing/token-refresh-service');
    const { createVideoPublish, updateVideoPublishStatus } = await import(
      '@/seed/db/repositories/video-publishes-repo'
    );
    const { getVideoBucket } = await import('../storage/r2-binding');
    const { createFeedbackCycle } = await import('@/tree/sop/performance-feedback-engine');

    // Verify video exists and user has access (check both videos table and engine_missions)
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');

    const videoCheck = await db
      .prepare('SELECT user_id FROM videos WHERE id = ?1 UNION SELECT user_id FROM engine_missions WHERE id = ?1')
      .bind(input.videoId)
      .first<{ user_id: string }>();

    if (!videoCheck || videoCheck.user_id !== userId) {
      return { success: false, error: 'Video not found or unauthorized', code: 'NOT_FOUND' };
    }

    // Create publish record
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

    // If scheduled for later, don't upload now
    if (input.scheduledAt && new Date(input.scheduledAt) > new Date()) {
      return { success: true, publishId: publish.id };
    }

    // Get platform credentials
    const creds = await getDecryptedCredentials(userId, input.platform);
    if (!creds) {
      return { success: false, error: `${input.platform} not connected`, code: 'NO_CREDENTIALS' };
    }

    const adapter = getAdapter(input.platform);

    // Auto-refresh if expired
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

    // Upload video
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

    // Auto-create performance feedback cycle if video corresponds to a Campaign or SOP Execution
    try {
      const dbForFeedback = getD1();
      if (!dbForFeedback) throw new Error('D1 unavailable');
      const sopExec = await dbForFeedback.prepare(
        `SELECT id, user_id, sop_template_id FROM sop_executions WHERE id = ?1 LIMIT 1`
      ).bind(input.videoId).first<{ id: string; user_id: string; sop_template_id: string }>();

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
        ).bind(input.videoId).first<{ id: string; user_id: string; template_id: string }>();

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
        videoId: input.videoId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

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

// ─── Video Retry ───────────────────────────────────────────────────────────────

/**
 * Retry a failed video job
 *
 * For engine_missions: resets status to pending and re-emits event.
 */
export async function retryVideo(
  jobId: string,
  userId: string,
): Promise<VideoRetryResult> {
  try {
    const db = createServerClient();

    // Verify ownership and fetch current status
    const { data: mission, error } = await db
      .from('engine_missions')
      .select('id, user_id, status, params')
      .eq('id', jobId)
      .single();

    if (error || !mission) {
      return { success: false, error: 'Job not found', code: 'NOT_FOUND' };
    }

    const missionData = mission as Record<string, unknown>;

    if (missionData.user_id !== userId) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const currentStatus = missionData.status as string;

    // Can only retry from failed state
    if (currentStatus !== 'failed') {
      return {
        success: false,
        error: `Cannot retry job in status: ${currentStatus}`,
        code: 'INVALID_STATUS',
      };
    }

    // Reset to pending for retry
    await db
      .from('engine_missions')
      .update({
        status: 'pending',
        error_message: null,
        updated_at: Math.floor(Date.now() / 1000),
      })
      .eq('id', jobId);

    logger.info('[VideoPublishingService] Video job retried', { jobId, userId });

    // Re-emit video/generate.requested event
    const { emitVideoGenerate } = await import('@/tree/video/events');
    const params = missionData.params as string | undefined;
    let prompt = '';
    try {
      const parsed = JSON.parse(params || '{}');
      prompt = parsed.prompt as string || '';
    } catch {
      /* ignore */
    }

    await emitVideoGenerate({
      missionId: jobId,
      tenantId: userId,
      userId,
      prompt,
      voiceoverText: prompt,
      language: 'en',
    }).catch(err => {
      logger.warn('[VideoPublishingService] Retry event emit failed', {
        jobId,
        error: err,
      });
    });

    return { success: true, jobId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    logger.error('[VideoPublishingService] retryVideo failed', {
      jobId,
      error: msg,
    });
    return { success: false, error: msg, code: 'INTERNAL_ERROR' };
  }
}
