/**
 * Video Generation Service
 *
 * Handles AI-powered video generation from prompts.
 * Manages quota, tier checks, and mission lifecycle.
 *
 * @module land/video/video-generation-service
 */

import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { TIER_ALLOWED_VIDEO } from '@/seed/config/tiers';
import { reserveVideoSlot } from '@/tree/quota/video-quota';
import { createAndDispatchVideoMission } from './video-mission-dispatcher';

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
  return Boolean(
    process.env.WAN_API_KEY &&
      process.env.FISH_SPEECH_API_KEY &&
      process.env.CLOUDCONVERT_API_KEY,
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
 */
export async function generateVideo(
  input: VideoGenerateInput,
  userId: string,
): Promise<VideoGenerateResult> {
  const { prompt, language = 'en' } = input;

  if (!aiPromptPipelineConfigured()) {
    return {
      success: false,
      error:
        'AI video studio is in operator preview. Please use the HeyGen mission flow or check back soon.',
      code: 'AI_VIDEO_UNAVAILABLE',
    };
  }

  if (typeof prompt !== 'string' || prompt.length < 10 || prompt.length > 500) {
    return {
      success: false,
      error: 'Prompt must be 10-500 characters',
      code: 'VALIDATION_ERROR',
    };
  }

  const tier = await resolveUserTier(userId);
  if (!TIER_ALLOWED_VIDEO.includes(tier)) {
    return {
      success: false,
      error: 'Video generation requires PREMIUM or higher',
      code: 'TIER_RESTRICTED',
    };
  }

  const reservation = await reserveVideoSlot(userId, tier);
  if (!reservation.reserved) {
    return {
      success: false,
      error: `Video quota exceeded (${reservation.used}/${reservation.limit} used this month). Resets ${reservation.resetAt}.`,
      code: 'QUOTA_EXCEEDED',
    };
  }

  return createAndDispatchVideoMission({
    userId,
    tier,
    prompt,
    style: input.style,
    language,
  });
}
