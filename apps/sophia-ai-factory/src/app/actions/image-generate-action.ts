'use server';

/**
 * Server Action: generateImageAction
 *
 * Thin controller:
 *  1. Authenticate via getCurrentUser() → 401 if null
 *  2. Validate input with Zod
 *  3. Tier-gate model access
 *  4. Delegate execution to Land image orchestrator
 *  5. Return result
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { TIER_ALLOWED_FAL_MODELS } from '@/seed/config/tiers/image-model-access';
import { executeImageGeneration } from '@/land/image';

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

function isFalModel(model: string): boolean {
  return model.startsWith('fal-ai/');
}

// ─── Action Controller ────────────────────────────────────────────────────────

export async function generateImageAction(
  input: unknown,
): Promise<ImageGenerateResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHENTICATED' };
  }

  const parsed = imageGenerateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((e) => e.message).join('; '),
      code: 'VALIDATION_ERROR',
    };
  }

  const { prompt, model, aspectRatio } = parsed.data;
  const tier = await resolveUserTier(user.id);

  if (!isFalModel(model)) {
    // The non-fal branch spends the platform's own MuAPI key without recording
    // a provider cost, so the action refuses those models outright instead of
    // consulting the tier map. The tier map below still guards the fal branch.
    return {
      success: false,
      error: `Model "${model}" is not supported. Choose a fal-ai/ model.`,
      code: 'TIER_GATE',
    };
  }

  const allowedFalModels = TIER_ALLOWED_FAL_MODELS[tier] ?? TIER_ALLOWED_FAL_MODELS.BASIC;
  if (!allowedFalModels.includes(model)) {
    return {
      success: false,
      error: `Model "${model}" is not available for your ${tier} plan.`,
      code: 'TIER_GATE',
    };
  }

  return executeImageGeneration({
    userId: user.id,
    tier,
    prompt,
    model,
    aspectRatio,
  });
}
