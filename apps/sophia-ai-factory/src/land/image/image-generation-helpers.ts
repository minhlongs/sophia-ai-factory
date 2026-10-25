/**
 * MuAPI Submission and Fal Failure Persistence Helpers for Image Generation Orchestrator.
 * @module land/image/image-generation-helpers
 */

import { createServerClient } from '@/seed/db/client';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { submitMediaJob } from '@/tree/clients/muapi-media-client';
import { findRecentDuplicateImageJob } from '@/tree/creative-studio/image-generation-idempotency';
import { ImageGenerationError } from '@/seed/ai/image-generation-provider';
import { logger } from '@/seed/utils/logger-utility';
import { mapFailureKindToErrorCategory } from '@/tree/media-jobs/error-category-mapper';
import { FailureKind } from '@/seed/types/failure-kind';
import { CostClassification } from '@/seed/types/creative-job-economics';
import type { GenerateImageJobInput, GenerateImageJobResult } from './image-generation-orchestrator';

export async function recordFailedFalImageJob(params: {
  jobId: string;
  userId: string;
  model: string;
  prompt: string;
  startTime: number;
  err: unknown;
}): Promise<GenerateImageJobResult> {
  const { jobId, userId, model, prompt, startTime, err } = params;
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof ImageGenerationError ? err.code : 'FAL_ERROR';
  const retryCount = err instanceof ImageGenerationError ? err.retryCount : undefined;
  const failureKind = Object.values(FailureKind).includes(code as FailureKind)
    ? (code as FailureKind)
    : FailureKind.UNKNOWN;
  const errorCategory = mapFailureKindToErrorCategory(failureKind);
  const failedAt = Math.floor(Date.now() / 1000);

  try {
    const db = createServerClient();
    await db.from('media_jobs').insert({
      id: jobId,
      user_id: userId,
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
    logger.error(
      '[image-orchestrator] failed to record failed job',
      dbErr instanceof Error ? dbErr : new Error(String(dbErr)),
    );
  }

  logger.warn('[image-orchestrator] fal-ai generation failed', { error: message, code });
  return { success: false, error: message, code };
}

/**
 * Submits a customer-BYOK MuAPI image job and records it in D1.
 *
 * Customer-paid BYOK only: resolves the customer's stored `'muapi'` key with NO
 * platform environment fallback (`process.env.MUAPI_API_KEY` is never read). If
 * the customer has not saved their own MuAPI key in the Setup Wizard, the job
 * is refused before any provider call with `NO_API_KEY`.
 */
export async function submitMuApiImageJob(
  input: GenerateImageJobInput,
): Promise<GenerateImageJobResult> {
  const { userId, prompt, model, aspectRatio } = input;

  const db = createServerClient();
  const duplicateJobId = await findRecentDuplicateImageJob(db, {
    userId,
    prompt,
    model,
  });
  if (duplicateJobId) {
    logger.info('[image-orchestrator] Returning deduplicated MuAPI image job', {
      userId,
      duplicateJobId,
      model,
    });
    return { success: true, jobId: duplicateJobId };
  }

  const apiKey = await resolveUserApiKey(userId, 'muapi');
  if (!apiKey) {
    return {
      success: false,
      error: 'MuAPI API key not configured. Add your MuAPI key in the Setup Wizard.',
      code: 'NO_API_KEY',
    };
  }

  const muResult = await submitMediaJob({ type: 'image', model, prompt, aspectRatio }, apiKey);
  if (!muResult.success || !muResult.job) {
    logger.warn('[image-orchestrator] MuAPI submission failed', { error: muResult.error });
    return { success: false, error: muResult.error ?? 'Failed to submit job', code: 'MUAPI_ERROR' };
  }

  const jobId = muResult.job.id;
  const { error: insertError } = (await db.from('media_jobs').insert({
    id: jobId,
    user_id: userId,
    type: 'image',
    model,
    prompt,
    status: 'pending',
    provider: 'muapi',
    cost_classification: CostClassification.UNMETERED,
    requested_at: Math.floor(Date.now() / 1000),
  })) as { error: { message: string } | null };

  if (insertError) {
    logger.error('[image-orchestrator] D1 insert failed', new Error(insertError.message));
    return { success: false, error: 'Failed to record job', code: 'DB_ERROR' };
  }

  return { success: true, jobId };
}
