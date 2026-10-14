import { NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';
import { ImageGenerationError } from '@/seed/ai/image-generation-provider';
import { logger } from '@/seed/utils/logger-utility';
import { trackUsage } from '@/forest/orchestration';
import { classifyCost } from '@/seed/types/creative-job-economics';
import { mapFailureKindToErrorCategory } from '@/tree/media-jobs/error-category-mapper';
import { FailureKind } from '@/seed/types/failure-kind';
import { TIER_ALLOWED_FAL_MODELS } from './config';

interface UserContext {
  id: string;
  email?: string | null;
}

export async function handleFalGeneration(
  user: UserContext,
  tier: string,
  prompt: string,
  model: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3',
): Promise<NextResponse> {
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
      tokensInput: result.latencyMs > 0 ? 0 : undefined,
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
      completed_at: Math.floor(Date.now() / 1000),
      latency_ms: result.latencyMs,
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
