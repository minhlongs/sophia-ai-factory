/**
 * Video Generation Service
 *
 * Handles AI-powered video generation from prompts.
 * Manages quota, tier checks, and mission lifecycle.
 *
 * @module land/video/video-generation-service
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { TIER_ALLOWED_VIDEO } from '@/seed/config/tiers';
import { reserveVideoSlot, releaseVideoSlot } from '@/tree/quota/video-quota';
import { emitVideoGenerate } from '@/tree/video/events';

// ─── Public Types ───────────────────────────────────────────────────────────────

export type VideoGenerateInput = {
  prompt: string;
  style?: 'cinematic' | 'casual' | 'educational';
  language?: 'en' | 'vi';
};

export type VideoGenerateResult =
  | { success: true; jobId: string; message?: string }
  | {
      success: false;
      error: string;
      code:
        | 'QUOTA_EXCEEDED'
        | 'TIER_RESTRICTED'
        | 'VALIDATION_ERROR'
        | 'AI_VIDEO_UNAVAILABLE'
        | 'DB_ERROR'
        | 'INTERNAL_ERROR';
    };

// ─── Configuration Check ───────────────────────────────────────────────────────

/**
 * Checks if the AI prompt pipeline is configured.
 * Returns true when all required API keys are present.
 */
export function aiPromptPipelineConfigured(): boolean {
  return (
    Boolean(
      process.env.WAN_API_KEY &&
        process.env.FISH_SPEECH_API_KEY &&
        process.env.CLOUDCONVERT_API_KEY,
    )
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
      error:
        'AI video studio is in operator preview. Please use the HeyGen mission flow or check back soon.',
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
    await releaseVideoSlot(userId).catch((err) => {
      logger.warn('Failed to release video slot on insert error', { error: String(err), context: 'generateVideo' });
    });
    return {
      success: false,
      error: `Failed to create mission: ${insertError.message}`,
      code: 'DB_ERROR',
    };
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
    logger.warn('[VideoGenerationService] Inngest send failed (non-fatal)', {
      missionId,
      error: err,
    });
    // Mission row is already created — event can be manually retried if needed
  }

  logger.info('[VideoGenerationService] Video generation started', {
    missionId,
    userId,
    tier,
  });

  return { success: true, jobId: missionId, message: 'Video generation started' };
}
