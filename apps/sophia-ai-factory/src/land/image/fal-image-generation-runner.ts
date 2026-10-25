/**
 * fal.ai Synchronous Image Generation Runner
 *
 * Handles fal-ai generation, R2 storage, D1 job recording, and MCU metering.
 *
 * @module land/image/fal-image-generation-runner
 */

import { createServerClient } from '@/seed/db/client';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';
import { storeFalImageInR2 } from '@/land/image/fal-image-r2-service';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { trackUsage, calculateCredits, hashLicenseKey, resolveUserLicenseNonce } from '@/tree/usage-metering';
import {
  buildImageIdempotencyKey,
  findRecentDuplicateImageJob,
} from '@/tree/creative-studio/image-generation-idempotency';
import { logger } from '@/seed/utils/logger-utility';
import { classifyCost } from '@/seed/types/creative-job-economics';
import { recordFailedFalImageJob } from './image-generation-helpers';
import type { GenerateImageJobInput, GenerateImageJobResult } from './image-generation-orchestrator';

export async function executeFalImageGeneration(
  input: GenerateImageJobInput,
): Promise<GenerateImageJobResult> {
  const { userId, tier, prompt, model, aspectRatio } = input;

  const db = createServerClient();
  const duplicateJobId = await findRecentDuplicateImageJob(db, {
    userId,
    prompt,
    model,
  });
  if (duplicateJobId) {
    logger.info('[image-orchestrator] Returning deduplicated fal-ai image job', {
      userId,
      duplicateJobId,
      model,
    });
    return { success: true, jobId: duplicateJobId };
  }

  const apiKey = await resolveUserApiKey(userId, 'fal-ai', process.env.FAL_KEY);
  if (!apiKey) {
    return { success: false, error: 'fal.ai API key not configured', code: 'NO_API_KEY' };
  }

  const jobId = `fal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const falProvider = new FalImageProvider({
    apiKey,
    model,
    keyRef: userId,
    requestId: jobId,
  });

  const startTime = Date.now();

  try {
    const result = await falProvider.generate({ prompt, aspectRatio });

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
      logger.error('[image-orchestrator] fal-ai R2 persist failed', r2Err instanceof Error ? r2Err : new Error(String(r2Err)));
      return { success: false, error: 'Failed to persist generated image', code: 'STORAGE_ERROR' };
    }

    const requestedAt = Math.floor(startTime / 1000);
    const { error: insertError } = await db.from('media_jobs').insert({
      id: jobId,
      user_id: userId,
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
      completed_at: Math.floor(Date.now() / 1000),
      latency_ms: result.latencyMs,
    }) as { error: { message: string } | null };

    if (insertError) {
      logger.error('[image-orchestrator] D1 insert failed for fal-ai', new Error(insertError.message));
      return { success: false, error: 'Failed to record job', code: 'DB_ERROR' };
    }

    const creditsToCharge = calculateCredits('fal-ai', 'imageGenerate', 1, tier);
    const licenseNonce = await resolveUserLicenseNonce(userId);
    const deducted = await deductCredits(userId, creditsToCharge, jobId, 'fal-ai:imageGenerate');
    if (!deducted) {
      logger.warn('[image-orchestrator] fal-ai credit deduction failed', { userId, jobId });
      return { success: false, error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' };
    }

    if (licenseNonce) {
      const idempotencyKey = buildImageIdempotencyKey({ userId, prompt, model, aspectRatio });
      await trackUsage({
        userId,
        licenseKeyHash: hashLicenseKey(licenseNonce),
        licenseNonce,
        service: 'fal-ai',
        endpoint: '/api/v1/creative-studio/images/generate',
        action: 'imageGenerate',
        creditsUsed: creditsToCharge,
        requestId: jobId,
        idempotencyKey,
        modelName: model,
        tierAtRequest: tier,
        statusCode: 200,
        responseTimeMs: result.latencyMs,
      });
    }

    return { success: true, jobId };
  } catch (err) {
    return recordFailedFalImageJob({ jobId, userId, model, prompt, startTime, err });
  }
}
