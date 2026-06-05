'use server';

/**
 * Server Action: generateImageAction
 *
 * Flow:
 *  1. Authenticate via getCurrentUser() → 401 if null
 *  2. Validate input with Zod
 *  3. Tier-gate model access
 *  4. Submit job to MuAPI
 *  5. Insert into media_jobs D1 table
 *  6. Return { jobId }
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { createServerClient } from '@/seed/db/client';
import { submitMediaJob, SUPPORTED_MODELS } from '@/tree/clients/muapi-media-client';
import { logger } from '@/seed/utils/logger-utility';

// ─── Input Schema ─────────────────────────────────────────────────────────────

const imageGenerateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  model: z.string(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3']).default('1:1'),
});

export type ImageGenerateInput = z.infer<typeof imageGenerateSchema>;

// ─── Result Types ─────────────────────────────────────────────────────────────

export type ImageGenerateResult =
  | { success: true; jobId: string }
  | { success: false; error: string; code?: string };

// ─── Tier model access map ────────────────────────────────────────────────────

const TIER_ALLOWED_MODELS: Record<string, string[]> = {
  BASIC: ['flux-schnell'],
  PREMIUM: ['flux-schnell', 'flux-dev', 'hidream'],
  ENTERPRISE: SUPPORTED_MODELS.image,
  MASTER: SUPPORTED_MODELS.image,
};

// ─── Action ──────────────────────────────────────────────────────────────────

export async function generateImageAction(
  input: unknown,
): Promise<ImageGenerateResult> {
  // Step 1: Auth
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHENTICATED' };
  }

  // Step 2: Validate input
  const parsed = imageGenerateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((e) => e.message).join('; '),
      code: 'VALIDATION_ERROR',
    };
  }

  const { prompt, model, aspectRatio } = parsed.data;

  // Step 3: Tier gate
  const tier = await resolveUserTier(user.id);
  const allowedModels = TIER_ALLOWED_MODELS[tier] ?? TIER_ALLOWED_MODELS.BASIC;
  if (!allowedModels.includes(model)) {
    return {
      success: false,
      error: `Model "${model}" is not available for your ${tier} plan.`,
      code: 'TIER_GATE',
    };
  }

  // Step 4: Submit to MuAPI
  const muResult = await submitMediaJob({ type: 'image', model, prompt, aspectRatio });
  if (!muResult.success || !muResult.job) {
    logger.warn('[image-generate-action] MuAPI submission failed', { error: muResult.error });
    return { success: false, error: muResult.error ?? 'Failed to submit job', code: 'MUAPI_ERROR' };
  }

  // Step 5: Insert media_jobs row
  const jobId = muResult.job.id;
  const db = createServerClient();
  const { error: insertError } = await db.from('media_jobs').insert({
    id: jobId,
    user_id: user.id,
    type: 'image',
    model,
    prompt,
    status: 'pending',
  }) as { error: { message: string } | null };

  if (insertError) {
    logger.error('[image-generate-action] D1 insert failed', new Error(insertError.message));
    return { success: false, error: 'Failed to record job', code: 'DB_ERROR' };
  }

  return { success: true, jobId };
}
