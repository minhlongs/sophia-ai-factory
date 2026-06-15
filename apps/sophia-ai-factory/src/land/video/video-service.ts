/**
 * Video Service — consolidated entry point for all video operations
 *
 * This service consolidates video business logic to avoid duplication across
 * server actions and inngest functions.
 *
 * Architecture: Land layer business logic (not duplicated in Forest/App)
 *
 * @module land/video/video-service
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import { getD1 } from '@/seed/db/client';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { TIER_ALLOWED_VIDEO } from '@/seed/config/tiers';
import { reserveVideoSlot, releaseVideoSlot } from '@/forest/quota/video-quota';
import { emitVideoGenerate } from '@/forest/missions/emit-video-generate';
import type { VideoJobStatus } from './video-job-fsm';

// ─── Public Types ───────────────────────────────────────────────────────────────

export type VideoGenerateInput = {
  prompt: string;
  style?: 'cinematic' | 'casual' | 'educational';
  language?: 'en' | 'vi';
};

export type VideoGenerateResult =
  | { success: true; jobId: string; message?: string }
  | { success: false; error: string; code: 'QUOTA_EXCEEDED' | 'TIER_RESTRICTED' | 'VALIDATION_ERROR' | 'AI_VIDEO_UNAVAILABLE' | 'DB_ERROR' | 'INTERNAL_ERROR' };

export type VideoPublishInput = {
  videoId: string;
  videoUrl: string;
  platform: 'youtube' | 'tiktok' | 'telegram';
  title: string;
  description: string;
  tags?: string[];
  privacy?: 'public' | 'unlisted' | 'private';
  scheduledAt?: string;
};

export type VideoPublishResult =
  | { success: true; publishId: string }
  | { success: false; error: string; code: string };

export type VideoStatusResult = {
  jobId: string;
  status: VideoJobStatus;
  progress: number;
  videoUrl?: string;
  error?: string;
  updatedAt: number;
};

export type VideoRetryResult =
  | { success: true; jobId: string }
  | { success: false; error: string; code: string };

// ─── Configuration Check ───────────────────────────────────────────────────────

export function aiPromptPipelineConfigured(): boolean {
  return Boolean(
    process.env.WAN_API_KEY
      && process.env.FISH_SPEECH_API_KEY
      && process.env.CLOUDCONVERT_API_KEY,
  );
}

// ─── Video Generation ───────────────────────────────────────────────────────────

/**
 * Generate a video from AI prompt
 *
 * Flow:
 * 1. Check operator configuration
 * 2. Validate input
 * 3. Check tier eligibility (PREMIUM+)
 * 4. Reserve video quota slot (atomic)
 * 5. Insert engine_missions row (status=pending, command=video.generate)
 * 6. Emit video/generate.requested Inngest event
 *
 * Uses production pipeline: engine_missions table + video/generate.requested event.
 */
export async function generateVideo(
  input: VideoGenerateInput,
  userId: string,
): Promise<VideoGenerateResult> {
  const { prompt, language = 'en' } = input;

  // Step 1: Operator configuration check
  if (!aiPromptPipelineConfigured()) {
    return {
      success: false,
      error: 'AI video studio is in operator preview. Please use the HeyGen mission flow or check back soon.',
      code: 'AI_VIDEO_UNAVAILABLE',
    };
  }

  // Step 2: Input validation
  if (typeof prompt !== 'string' || prompt.length < 10 || prompt.length > 500) {
    return {
      success: false,
      error: 'Prompt must be 10-500 characters',
      code: 'VALIDATION_ERROR',
    };
  }

  // Step 3: Tier check
  const tier = await resolveUserTier(userId);
  if (!TIER_ALLOWED_VIDEO.includes(tier)) {
    return {
      success: false,
      error: 'Video generation requires PREMIUM or higher',
      code: 'TIER_RESTRICTED',
    };
  }

  // Step 4: Quota reservation
  const reservation = await reserveVideoSlot(userId, tier);
  if (!reservation.reserved) {
    return {
      success: false,
      error: `Video quota exceeded (${reservation.used}/${reservation.limit} used this month). Resets ${reservation.resetAt}.`,
      code: 'QUOTA_EXCEEDED',
    };
  }

  // Step 5: Insert engine_missions row
  const missionId = crypto.randomUUID();
  const db = createServerClient();

  const { error: insertError } = await db
    .from('engine_missions')
    .insert({
      id: missionId,
      user_id: userId,
      command: 'video.generate',
      params: JSON.stringify({ prompt, style: input.style, language }),
      status: 'pending',
    }) as { error: { message: string } | null };

  if (insertError) {
    await releaseVideoSlot(userId).catch(() => undefined);
    return { success: false, error: `Failed to create mission: ${insertError.message}`, code: 'DB_ERROR' };
  }

  // Step 6: Emit video/generate.requested event
  try {
    await emitVideoGenerate({
      missionId,
      tenantId: userId,
      userId,
      prompt,
      voiceoverText: prompt,
      language,
    });
  } catch (err) {
    logger.warn('[VideoService] Inngest send failed (non-fatal)', { missionId, error: err });
    // Mission row is already created — event can be manually retried if needed
  }

  logger.info('[VideoService] Video generation started', { missionId, userId, tier });

  return { success: true, jobId: missionId, message: 'Video generation started' };
}

// ─── Video Status Polling ───────────────────────────────────────────────────────

/**
 * Get current status of a video job from engine_missions
 */
export async function getVideoStatus(jobId: string, userId?: string): Promise<VideoStatusResult | null> {
  try {
    const db = createServerClient();

    const { data: mission, error } = await db
      .from('engine_missions')
      .select('id, status, result, error_message, updated_at')
      .eq('id', jobId)
      .single();

    if (error || !mission) {
      return null;
    }

    const missionData = mission as Record<string, unknown>;

    // If user provided, verify ownership
    if (userId && missionData.user_id !== userId) {
      return null;
    }

    const status = missionData.status as VideoJobStatus;
    const progress = getProgressForStatus(status);
    const result = missionData.result as string | undefined;
    const errorMessage = missionData.error_message as string | undefined;
    const updatedAt = (missionData.updated_at as number) || Math.floor(Date.now() / 1000);

    return {
      jobId: missionData.id as string,
      status,
      progress,
      videoUrl: result ? JSON.parse(result).video_url : undefined,
      error: errorMessage,
      updatedAt,
    };
  } catch (err) {
    logger.error('[VideoService] getVideoStatus failed', { jobId, error: err });
    return null;
  }
}

function getProgressForStatus(status: VideoJobStatus): number {
  const progressMap: Record<string, number> = {
    pending: 0,
    running: 30,
    succeeded: 100,
    failed: 0,
  };
  return progressMap[status] ?? 0;
}

// ─── Video Retry ───────────────────────────────────────────────────────────────

/**
 * Retry a failed video job
 *
 * For engine_missions: resets status to pending and re-emits event.
 */
export async function retryVideo(jobId: string, userId: string): Promise<VideoRetryResult> {
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
      return { success: false, error: `Cannot retry job in status: ${currentStatus}`, code: 'INVALID_STATUS' };
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

    logger.info('[VideoService] Video job retried', { jobId, userId });

    // Re-emit video/generate.requested event
    const params = missionData.params as string | undefined;
    let prompt = '';
    try {
      const parsed = JSON.parse(params || '{}');
      prompt = parsed.prompt as string || '';
    } catch { /* ignore */ }

    await emitVideoGenerate({
      missionId: jobId,
      tenantId: userId,
      userId,
      prompt,
      voiceoverText: prompt,
      language: 'en',
    }).catch(err => {
      logger.warn('[VideoService] Retry event emit failed', { jobId, error: err });
    });

    return { success: true, jobId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    logger.error('[VideoService] retryVideo failed', { jobId, error: msg });
    return { success: false, error: msg, code: 'INTERNAL_ERROR' };
  }
}

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
    const { getDecryptedCredentials, storeCredentials, getClientCredentials } = await import('@/forest/publishing/credential-manager');
    const { getAdapter } = await import('@/forest/publishing/token-refresh-service');
    const { createVideoPublish, updateVideoPublishStatus } = await import('@/seed/db/repositories/video-publishes-repo');
    const { getVideoBucket } = await import('./r2-binding');
    const { logger } = await import('@/seed/utils/logger-utility');
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
      platform: input.platform as 'youtube' | 'tiktok' | 'telegram',
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
    logger.error('[VideoService] publishVideo failed', { videoId: input.videoId, error: msg });
    return { success: false, error: msg, code: 'INTERNAL_ERROR' };
  }
}

// ─── Export Default Service Object ─────────────────────────────────────────────

export const videoService = {
  generateVideo,
  publishVideo,
  getVideoStatus,
  retryVideo,
  aiPromptPipelineConfigured,
};
