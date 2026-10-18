/**
 * Video Mission Dispatcher
 *
 * Persists engine_missions rows and dispatches video/generate.requested events.
 *
 * @module land/video/publishing/video-mission-dispatcher
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import { releaseVideoSlot } from '@/tree/quota/video-quota';
import { emitVideoGenerate } from '@/tree/video/events';
import type { VideoGenerateInput, VideoGenerateResult } from './video-generation.service';

export async function createAndDispatchVideoMission(params: {
  userId: string;
  tier: string;
  prompt: string;
  style?: VideoGenerateInput['style'];
  language: 'en' | 'vi';
}): Promise<VideoGenerateResult> {
  const { userId, tier, prompt, style, language } = params;
  const missionId = crypto.randomUUID();
  const db = createServerClient();

  const { error: insertError } = (await db.from('engine_missions').insert({
    id: missionId,
    user_id: userId,
    command: 'video.generate',
    params: JSON.stringify({ prompt, style, language }),
    status: 'pending',
  })) as { error: { message: string } | null };

  if (insertError) {
    await releaseVideoSlot(userId).catch((err) => {
      logger.warn('Failed to release video slot on insert error', {
        error: String(err),
        context: 'generateVideo',
      });
    });
    return {
      success: false,
      error: `Failed to create mission: ${insertError.message}`,
      code: 'DB_ERROR',
    };
  }

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
    logger.warn('[VideoGenerationService] Inngest send failed (non-fatal)', {
      missionId,
      error: err,
    });
  }

  logger.info('[VideoGenerationService] Video generation started', {
    missionId,
    userId,
    tier,
  });

  return { success: true, jobId: missionId, message: 'Video generation started' };
}
