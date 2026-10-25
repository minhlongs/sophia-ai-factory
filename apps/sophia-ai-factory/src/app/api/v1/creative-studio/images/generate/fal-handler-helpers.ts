import { NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { ImageGenerationError, type ImageGenerationResult } from '@/seed/ai/image-generation-provider';
import { logger } from '@/seed/utils/logger-utility';
import { trackUsage } from '@/forest/orchestration';
import { classifyCost } from '@/seed/types/creative-job-economics';
import { mapFailureKindToErrorCategory } from '@/tree/media-jobs/error-category-mapper';
import { FailureKind } from '@/seed/types/failure-kind';
import { buildImageIdempotencyKey } from '@/tree/creative-studio/image-generation-idempotency';

export interface FalUserContext {
  id: string;
  email?: string | null;
}

export async function recordFalCompletedJob(params: {
  user: FalUserContext;
  tier: string;
  prompt: string;
  model: string;
  aspectRatio?: string;
  startTime: number;
  result: ImageGenerationResult;
}): Promise<NextResponse> {
  const { user, tier, prompt, model, aspectRatio, startTime, result } = params;
  const idempotencyKey = buildImageIdempotencyKey({
    userId: user.id,
    prompt,
    model,
    aspectRatio,
  });
  await trackUsage({
    userId: user.id,
    licenseKeyHash: user.email || user.id || '',
    licenseNonce: user.id || '',
    service: 'fal-ai',
    endpoint: 'image-generation',
    action: 'completed',
    tokensInput: result.latencyMs > 0 ? 0 : undefined,
    tokensOutput: undefined,
    creditsUsed: result.costCents || 0,
    tierAtRequest: tier,
    idempotencyKey,
    modelName: model,
    responseTimeMs: result.latencyMs,
  });

  const jobId = `fal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const db = createServerClient();
  const requestedAt = Math.floor(startTime / 1000);
  const { error: insertError } = (await db.from('media_jobs').insert({
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
  })) as { error: { message: string } | null };

  if (insertError) {
    logger.error('[creative-studio/images/generate] D1 insert failed for fal-ai', new Error(insertError.message));
    return NextResponse.json({ message: 'Failed to record job' }, { status: 500 });
  }

  return NextResponse.json({ jobId }, { status: 201 });
}

export async function recordFalFailedJob(params: {
  err: unknown;
  user: FalUserContext;
  tier: string;
  prompt: string;
  model: string;
  startTime: number;
}): Promise<NextResponse> {
  const { err, user, tier, prompt, model, startTime } = params;
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof ImageGenerationError ? err.code : 'FAL_ERROR';
  const retryCount = err instanceof ImageGenerationError ? err.retryCount : undefined;
  const failureKind = Object.values(FailureKind).includes(code as FailureKind)
    ? (code as FailureKind)
    : FailureKind.UNKNOWN;
  const failedAt = Math.floor(Date.now() / 1000);
  logger.warn('[creative-studio/images/generate] fal-ai generation failed', { error: message, code });

  try {
    const db = createServerClient();
    await db.from('media_jobs').insert({
      id: `fal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      user_id: user.id,
      type: 'image',
      model,
      prompt,
      status: 'failed',
      provider: 'fal-ai',
      error_category: mapFailureKindToErrorCategory(failureKind),
      retry_count: retryCount ?? null,
      cost_classification: 'UNKNOWN',
      requested_at: failedAt,
      started_at: failedAt,
      latency_ms: Date.now() - startTime,
    });
  } catch (dbErr) {
    logger.error('[creative-studio/images/generate] failed to record failed job', dbErr instanceof Error ? dbErr : new Error(String(dbErr)));
  }

  await trackUsage({
    userId: user.id,
    licenseKeyHash: user.email || user.id || '',
    licenseNonce: user.id || '',
    service: 'fal-ai',
    endpoint: 'image-generation',
    action: 'failed',
    creditsUsed: 0,
    tierAtRequest: tier,
    idempotencyKey: buildImageIdempotencyKey({
      userId: user.id,
      prompt,
      model,
    }),
    errorMessage: message,
    responseTimeMs: 0,
  });

  return NextResponse.json({ message }, { status: 502 });
}
