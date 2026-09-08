/**
 * POST /api/v1/creative-studio/images/generate
 *
 * API route alternative to the image-generate-action server action.
 * Intended for API consumers (e.g., Telegram bot, external clients).
 *
 * Body: { prompt: string, model: string, aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' }
 * Response: { jobId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { createServerClient } from '@/seed/db/client';
import { submitMediaJob, SUPPORTED_MODELS } from '@/tree/clients/muapi-media-client';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';
import { ImageGenerationError } from '@/seed/ai/image-generation-provider';
import { logger } from '@/seed/utils/logger-utility';
import { trackUsage } from '@/forest/orchestration';
import { classifyCost } from '@/seed/types/creative-job-economics';
import { mapFailureKindToErrorCategory } from '@/tree/media-jobs/error-category-mapper';
import { FailureKind } from '@/seed/types/failure-kind';

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  model: z.string(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3']).default('1:1'),
});

const TIER_ALLOWED_MODELS: Record<string, string[]> = {
  BASIC: ['flux-schnell'],
  PREMIUM: ['flux-schnell', 'flux-dev', 'hidream'],
  ENTERPRISE: SUPPORTED_MODELS.image,
  MASTER: SUPPORTED_MODELS.image,
};

/** fal-ai models per tier (EXPERIMENTAL). */
const TIER_ALLOWED_FAL_MODELS: Record<string, string[]> = {
  BASIC: ['fal-ai/flux-schnell'],
  PREMIUM: ['fal-ai/flux-schnell'],
  ENTERPRISE: ['fal-ai/flux-schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro'],
  MASTER: ['fal-ai/flux-schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro'],
};

function isFalModel(model: string): boolean {
  return model.startsWith('fal-ai/');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Parse + validate body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues.map((e) => e.message).join('; ') },
      { status: 400 },
    );
  }

  const { prompt, model, aspectRatio } = parsed.data;

  // Tier gate
  const tier = await resolveUserTier(user.id);

  // fal-ai provider routing (EXPERIMENTAL)
  if (isFalModel(model)) {
    const allowedFalModels = TIER_ALLOWED_FAL_MODELS[tier] ?? TIER_ALLOWED_FAL_MODELS.BASIC;
    if (!allowedFalModels.includes(model)) {
      return NextResponse.json(
        { message: `Model "${model}" is not available for your ${tier} plan.` },
        { status: 403 },
      );
    }

    const apiKey = await resolveUserApiKey(user.id, 'fal-ai', process.env.FAL_KEY);
    if (!apiKey) {
      return NextResponse.json({ message: 'fal.ai API key not configured' }, { status: 502 });
    }

    const falProvider = new FalImageProvider({ apiKey, model, keyRef: user.id });

    const startTime = Date.now();

    try {
      const result = await falProvider.generate({ prompt, aspectRatio });

      // Track usage for successful job with all required UsageEventInput fields
      const userEmail = user.email || user.id || '';
      await trackUsage({
        userId: user.id,
        licenseKeyHash: userEmail,
        licenseNonce: user.id || '',
        service: 'fal-ai',
        endpoint: 'image-generation',
        action: 'completed',
        tokensInput: result.latencyMs > 0 ? 0 : undefined, // Fal.ai result doesn't expose tokens directly
        tokensOutput: undefined,
        creditsUsed: result.costCents || 0,
        tierAtRequest: tier,
        idempotencyKey: `${user.id}-${Date.now()}`,
        modelName: model,
        responseTimeMs: result.latencyMs,
      });

      // Sync provider: insert terminal row with result_url
      const jobId = `fal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const db = createServerClient();
      const requestedAt = Math.floor(startTime / 1000);
      const { error: insertError } = await db.from('media_jobs').insert({
        id: jobId,
        user_id: user.id,
        type: 'image',
        model,
        prompt,
        status: 'completed',
        result_url: result.assetRef,
        provider: 'fal-ai',
        provider_cost: result.costCents ?? null,
        cost_currency: result.costCents != null ? 'USD' : null,
        cost_classification: result.costClassification ?? classifyCost(result.costCents, false),
        retry_count: result.retryCount ?? null,
        revenue_attribution: null,
        gross_margin: null,
        requested_at: result.requestedAt ?? requestedAt,
        started_at: result.startedAt ?? requestedAt,
        completed_at: requestedAt,
      }) as { error: { message: string } | null };

      if (insertError) {
        logger.error('[creative-studio/images/generate] D1 insert failed for fal-ai', new Error(insertError.message));
        return NextResponse.json({ message: 'Failed to record job' }, { status: 500 });
      }

      return NextResponse.json({ jobId }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof ImageGenerationError ? err.code : 'FAL_ERROR';
      const retryCount = err instanceof ImageGenerationError ? err.retryCount : undefined;
      const failureKind = Object.values(FailureKind).includes(code as FailureKind)
        ? (code as FailureKind)
        : FailureKind.UNKNOWN;
      const errorCategory = mapFailureKindToErrorCategory(failureKind);
      const failedAt = Math.floor(Date.now() / 1000);
      logger.warn('[creative-studio/images/generate] fal-ai generation failed', { error: message, code });
      const status = code === 'CIRCUIT_BREAKER_OPEN' ? 502 : 502;

      // Best-effort: record the failed job for the economic loop.
      // Never let insert failure mask the original error to the caller.
      try {
        const failJobId = `fal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const db = createServerClient();
        await db.from('media_jobs').insert({
          id: failJobId,
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
        logger.error('[creative-studio/images/generate] failed to record failed job', dbErr instanceof Error ? dbErr : new Error(String(dbErr)));
      }

      // Track usage for failed job with all required UsageEventInput fields
      const userEmail = user.email || user.id || '';
      await trackUsage({
        userId: user.id,
        licenseKeyHash: userEmail,
        licenseNonce: user.id || '',
        service: 'fal-ai',
        endpoint: 'image-generation',
        action: 'failed',
        creditsUsed: 0,
        tierAtRequest: tier,
        idempotencyKey: `${user.id}-${Date.now()}`,
        errorMessage: message,
        responseTimeMs: 0,
      });

      return NextResponse.json({ message }, { status });
    }
  }

  // MuAPI path (existing, unchanged)
  const allowedModels = TIER_ALLOWED_MODELS[tier] ?? TIER_ALLOWED_MODELS.BASIC;
  if (!allowedModels.includes(model)) {
    return NextResponse.json(
      { message: `Model "${model}" is not available for your ${tier} plan.` },
      { status: 403 },
    );
  }

  // Submit to MuAPI
  const muResult = await submitMediaJob({ type: 'image', model, prompt, aspectRatio });
  if (!muResult.success || !muResult.job) {
    logger.warn('[creative-studio/images/generate] MuAPI failed', { error: muResult.error });
    return NextResponse.json({ message: 'Failed to submit generation job' }, { status: 502 });
  }

  const jobId = muResult.job.id;

  // Persist to D1
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
    logger.error('[creative-studio/images/generate] D1 insert failed', new Error(insertError.message));
    return NextResponse.json({ message: 'Failed to record job' }, { status: 500 });
  }

  return NextResponse.json({ jobId }, { status: 201 });
}
