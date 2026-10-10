/**
 * Video Retrier
 * Layer: land/video/publishing
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import type { VideoRetryResult } from './types';

/**
 * Retry a failed video job.
 * For engine_missions: resets status to pending and re-emits event.
 */
export async function retryVideo(
  jobId: string,
  userId: string,
): Promise<VideoRetryResult> {
  try {
    const db = createServerClient();

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

    if (currentStatus !== 'failed') {
      return {
        success: false,
        error: `Cannot retry job in status: ${currentStatus}`,
        code: 'INVALID_STATUS',
      };
    }

    await db
      .from('engine_missions')
      .update({
        status: 'pending',
        error_message: null,
        updated_at: Math.floor(Date.now() / 1000),
      })
      .eq('id', jobId);

    logger.info('[VideoPublishingService] Video job retried', { jobId, userId });

    const { emitVideoGenerate } = await import('@/tree/video/events');
    const params = missionData.params as string | undefined;
    let prompt = '';
    try {
      const parsed = JSON.parse(params || '{}');
      prompt = (parsed.prompt as string) || '';
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
    }).catch((err) => {
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
