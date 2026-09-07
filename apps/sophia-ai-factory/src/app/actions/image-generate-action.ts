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
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';
import { ImageGenerationError } from '@/seed/ai/image-generation-provider';
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

/**
 * fal-ai models available per tier. fal-ai is EXPERIMENTAL — only specific
 * models unlocked per tier. Model names use the `fal-ai/` prefix convention.
 */
const TIER_ALLOWED_FAL_MODELS: Record<string, string[]> = {
  BASIC: ['fal-ai/flux-schnell'],
  PREMIUM: ['fal-ai/flux-schnell'],
  ENTERPRISE: ['fal-ai/flux-schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro'],
  MASTER: ['fal-ai/flux-schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro'],
};

const TIER_ALLOWED_MODELS: Record<string, string[]> = {
  BASIC: ['flux-schnell'],
  PREMIUM: ['flux-schnell', 'flux-dev', 'hidream'],
  ENTERPRISE: SUPPORTED_MODELS.image,
  MASTER: SUPPORTED_MODELS.image,
};

/** Check if a model is a fal-ai model (uses the fal-ai/ prefix). */
function isFalModel(model: string): boolean {
  return model.startsWith('fal-ai/');
}

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

  // fal-ai models use separate tier gating
  if (isFalModel(model)) {
    const allowedFalModels = TIER_ALLOWED_FAL_MODELS[tier] ?? TIER_ALLOWED_FAL_MODELS.BASIC;
    if (!allowedFalModels.includes(model)) {
      return {
        success: false,
        error: `Model "${model}" is not available for your ${tier} plan.`,
        code: 'TIER_GATE',
      };
    }

    // Step 4 (fal-ai): Resolve BYOK key and generate synchronously
    const apiKey = await resolveUserApiKey(user.id, 'fal-ai', process.env.FAL_KEY);
    if (!apiKey) {
      return { success: false, error: 'fal.ai API key not configured', code: 'NO_API_KEY' };
    }

    const falProvider = new FalImageProvider({
      apiKey,
      model,
      keyRef: user.id,
    });

    try {
      const result = await falProvider.generate({ prompt, aspectRatio });

      // Step 5 (fal-ai): Insert media_jobs row — sync provider, terminal on creation
      const jobId = `fal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const db = createServerClient();
      const { error: insertError } = await db.from('media_jobs').insert({
        id: jobId,
        user_id: user.id,
        type: 'image',
        model,
        prompt,
        status: 'completed',
        result_url: result.assetRef,
        provider: 'fal-ai',
      }) as { error: { message: string } | null };

      if (insertError) {
        logger.error('[image-generate-action] D1 insert failed for fal-ai', new Error(insertError.message));
        return { success: false, error: 'Failed to record job', code: 'DB_ERROR' };
      }

      return { success: true, jobId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof ImageGenerationError ? err.code : 'FAL_ERROR';
      logger.warn('[image-generate-action] fal-ai generation failed', { error: message, code });
      return { success: false, error: message, code };
    }
  }

  // MuAPI path (existing, unchanged)
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
