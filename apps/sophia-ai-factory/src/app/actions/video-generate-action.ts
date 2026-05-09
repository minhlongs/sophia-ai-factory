'use server';

/**
 * Server Action: generateVideoAction
 *
 * Flow:
 *  1. Authenticate via getCurrentUser() → 401 if null
 *  2. Validate input with Zod
 *  3. Check video quota via reserveVideoSlot() (atomic UPSERT)
 *  4. Insert engine_missions row (status=pending)
 *  5. Emit video/generate.requested Inngest event
 *  6. Return { missionId }
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { createServerClient } from '@/seed/db/client';
import { reserveVideoSlot, releaseVideoSlot } from '@/forest/quota/video-quota';
import { emitVideoGenerate } from '@/forest/missions/emit-video-generate';

// ─── Input Schema ─────────────────────────────────────────────────────────────

export const videoGenerateSchema = z.object({
  prompt: z.string().min(10).max(500),
  style: z.enum(['cinematic', 'casual', 'educational']).default('casual'),
  language: z.enum(['en', 'vi']).default('en'),
});

export type VideoGenerateInput = z.infer<typeof videoGenerateSchema>;

// ─── Result Types ─────────────────────────────────────────────────────────────

export type VideoGenerateResult =
  | { success: true; missionId: string }
  | { success: false; error: string; code?: string };

// ─── Action ──────────────────────────────────────────────────────────────────

export async function generateVideoAction(
  input: unknown,
): Promise<VideoGenerateResult> {
  // Step 1: Auth
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHENTICATED' };
  }

  // Step 2: Validate input
  const parsed = videoGenerateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((e: { message: string }) => e.message).join('; '),
      code: 'VALIDATION_ERROR',
    };
  }

  const { prompt, language } = parsed.data;

  // Step 3: Atomic quota reservation
  const tier = await getUserTier(user.id);
  const reservation = await reserveVideoSlot(user.id, tier);
  if (!reservation.reserved) {
    return {
      success: false,
      error: `Video quota exceeded (${reservation.used}/${reservation.limit} used this month). Resets ${reservation.resetAt}.`,
      code: 'QUOTA_EXCEEDED',
    };
  }

  // Step 4: Insert engine_missions row
  const missionId = crypto.randomUUID();

  const db = createServerClient();
  const { error: insertError } = await db.from('engine_missions').insert({
    id: missionId,
    user_id: user.id,
    command: 'video.generate',
    params: JSON.stringify({ prompt, style: parsed.data.style, language }),
    status: 'pending',
  }) as { error: { message: string } | null };

  if (insertError) {
    // Release reserved quota slot — mission failed to create, slot must not be consumed.
    await releaseVideoSlot(user.id).catch(() => undefined);
    return { success: false, error: 'Failed to create mission', code: 'DB_ERROR' };
  }

  // Step 5: Emit Inngest event (only fires after confirmed insert)
  await emitVideoGenerate({
    missionId,
    tenantId: user.id,
    userId: user.id,
    prompt,
    voiceoverText: prompt,
    language,
  });

  return { success: true, missionId };
}
