/**
 * Image Generation Orchestrator — Domain Service
 *
 * Encapsulates the execution pipeline for image generation jobs:
 *  - fal-ai synchronous generation via FalImageProvider, R2 upload, and MCU metering
 *  - MuAPI media job submission and D1 tracking
 *
 * @module land/image/image-generation-orchestrator
 */

import { createServerClient } from '@/seed/db/client';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';
import { storeFalImageInR2 } from '@/land/image/fal-image-r2-service';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { trackUsage, calculateCredits, hashLicenseKey, resolveUserLicenseNonce } from '@/tree/usage-metering';
import { logger } from '@/seed/utils/logger-utility';
import { classifyCost } from '@/seed/types/creative-job-economics';
import { recordFailedFalImageJob, submitMuApiImageJob } from './image-generation-helpers';

export interface GenerateImageJobInput {
  userId: string;
  tier: string;
  prompt: string;
  model: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
}

export type GenerateImageJobResult =
  | { success: true; jobId: string }
  | { success: false; error: string; code?: string };

export async function executeImageGeneration(
  input: GenerateImageJobInput,
): Promise<GenerateImageJobResult> {
  const { userId, tier, prompt, model, aspectRatio } = input;

  if (model.startsWith('fal-ai/')) {
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

      const db = createServerClient();
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
        await trackUsage({
          userId,
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
      return recordFailedFalImageJob({ jobId, userId, model, prompt, startTime, err });
    }
  }

  return submitMuApiImageJob(input);
}
