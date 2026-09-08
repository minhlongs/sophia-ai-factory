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
import { storeFalImageInR2 } from '@/land/image/fal-image-r2-service';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { trackUsage, calculateCredits, hashLicenseKey, resolveUserLicenseNonce } from '@/tree/usage-metering';
import { logger } from '@/seed/utils/logger-utility';
import { classifyCost } from '@/seed/types/creative-job-economics';
import { mapFailureKindToErrorCategory } from '@/tree/media-jobs/error-category-mapper';
import { FailureKind } from '@/seed/types/failure-kind';

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

    // jobId generated first so it is deterministic for both the R2 storage key
    // and the requestId-scoped provider logging (structured observability).
    const jobId = `fal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const falProvider = new FalImageProvider({
      apiKey,
      model,
      keyRef: user.id,
      requestId: jobId,
    });

    const startTime = Date.now();

    try {
      const result = await falProvider.generate({ prompt, aspectRatio });

      // Step 4.5 (fal-ai): Self-host the fal CDN image into R2.

      let resultUrl = result.assetRef;
      let storageKey = '';
      let bucket = '';
      let sizeBytes = 0;
      try {
        const r2 = await storeFalImageInR2(result.assetRef, jobId);
        resultUrl = r2.permanentUrl;
        storageKey = r2.storageKey;
        bucket = r2.bucket;
        sizeBytes = r2.sizeBytes;
      } catch (r2Err) {
        // R2 download/PUT failed — do not mark the job completed with a
        // transient CDN URL. Surface 500 so the caller can retry.
        logger.error('[image-generate-action] fal-ai R2 persist failed', r2Err instanceof Error ? r2Err : new Error(String(r2Err)));
        return { success: false, error: 'Failed to persist generated image', code: 'STORAGE_ERROR' };
      }

      // Step 5 (fal-ai): Insert media_jobs row — sync provider, terminal on creation
      const db = createServerClient();
      const requestedAt = Math.floor(startTime / 1000);
      const { error: insertError } = await db.from('media_jobs').insert({
        id: jobId,
        user_id: user.id,
        type: 'image',
        model,
        prompt,
        status: 'completed',
        result_url: resultUrl,
        mime: 'image/png',
        size: sizeBytes,
        storage_key: storageKey || null,
        bucket: bucket || null,
        provider: 'fal-ai',
        provider_cost: result.costCents ?? null,
        cost_currency: result.costCents != null ? 'USD' : null,
        cost_classification: result.costClassification ?? classifyCost(result.costCents, false),
        retry_count: result.retryCount ?? null,
        revenue_attribution: null,
        gross_margin: null,
        requested_at: result.requestedAt ?? requestedAt,
        started_at: result.startedAt ?? requestedAt,
      }) as { error: { message: string } | null };

      if (insertError) {
        logger.error('[image-generate-action] D1 insert failed for fal-ai', new Error(insertError.message));
        return { success: false, error: 'Failed to record job', code: 'DB_ERROR' };
      }

      // Step 6 (fal-ai): Charge MCU credits ONCE after R2 persist + D1 insert.
      // Retry happens inside the provider; credit deduction is a platform
      // side effect charged exactly once on success (no double-charge).
      const creditsToCharge = calculateCredits('fal-ai', 'imageGenerate', 1, tier);
      const licenseNonce = await resolveUserLicenseNonce(user.id);
      const deducted = await deductCredits(user.id, creditsToCharge, jobId, 'fal-ai:imageGenerate');
      if (!deducted) {
        logger.warn('[image-generate-action] fal-ai credit deduction failed', { userId: user.id, jobId });
        return { success: false, error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' };
      }

      // Step 7 (fal-ai): Emit usage event for metering parity with HeyGen.
      if (licenseNonce) {
        await trackUsage({
          userId: user.id,
          licenseKeyHash: hashLicenseKey(licenseNonce),
          licenseNonce,
          service: 'fal-ai',
          endpoint: '/api/v1/creative-studio/images/generate',
          action: 'imageGenerate',
          creditsUsed: creditsToCharge,
          requestId: jobId,
          modelName: model,
          tierAtRequest: tier,
          statusCode: 200,
          responseTimeMs: result.latencyMs,
        });
      }

      return { success: true, jobId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof ImageGenerationError ? err.code : 'FAL_ERROR';
      const retryCount = err instanceof ImageGenerationError ? err.retryCount : undefined;
      const failureKind = Object.values(FailureKind).includes(code as FailureKind)
        ? (code as FailureKind)
        : FailureKind.UNKNOWN;
      const errorCategory = mapFailureKindToErrorCategory(failureKind);
      const failedAt = Math.floor(Date.now() / 1000);

      // Best-effort: record the failed job for the economic loop.
      // Never let insert failure mask the original error to the user.
      try {
        const db = createServerClient();
        await db.from('media_jobs').insert({
          id: jobId,
          user_id: user.id,
          type: 'image',
          model,
          prompt,
          status: 'failed',
          provider: 'fal-ai',
          error_category: errorCategory,
          retry_count: retryCount ?? null,
          cost_classification: 'UNKNOWN',
          requested_at: failedAt,
          started_at: failedAt,
          latency_ms: Date.now() - startTime,
        });
      } catch (dbErr) {
        logger.error('[image-generate-action] failed to record failed job', dbErr instanceof Error ? dbErr : new Error(String(dbErr)));
      }

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
    cost_classification: 'UNKNOWN',
    requested_at: Math.floor(Date.now() / 1000),
  }) as { error: { message: string } | null };

  if (insertError) {
    logger.error('[image-generate-action] D1 insert failed', new Error(insertError.message));
    return { success: false, error: 'Failed to record job', code: 'DB_ERROR' };
  }

  return { success: true, jobId };
}
