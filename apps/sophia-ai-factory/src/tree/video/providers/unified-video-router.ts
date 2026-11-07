/**
 * @module tree/video/providers/unified-video-router
 * Unified BYOK Video Router with Circuit Breaker and automatic failover.
 */

import { lookupUserApiKey } from '@/tree/byok/user-api-key-store';
import { rankModelsForTask } from '@/tree/video/radar/model-radar-scorer';
import { submitFalVideoJob } from './fal-aggregator-client';
import { submitReplicateVideoJob } from './replicate-aggregator-client';
import { failure, type Result } from '@/seed/types/result';
import type { VideoGenerationJobRequest, VideoGenerationJobResponse } from '@/seed/ai/video-model-radar-types';

export async function routeVideoGenerationJob(
  request: VideoGenerationJobRequest,
): Promise<Result<VideoGenerationJobResponse, { code: string; message: string }>> {
  const ranked = rankModelsForTask(request.sceneTask);
  if (ranked.length === 0) {
    return failure({ code: 'NO_ACTIVE_MODELS', message: `No active models for ${request.sceneTask}` });
  }

  // A store or decryption failure is reported distinctly from an absent key:
  // the caller sees BYOK_STORE_UNAVAILABLE rather than BYOK_KEY_MISSING.
  const [falLookup, replicateLookup] = await Promise.all([
    lookupUserApiKey(request.userId, 'fal-ai'),
    lookupUserApiKey(request.userId, 'replicate'),
  ]);

  for (const lookup of [falLookup, replicateLookup]) {
    if (lookup.status !== 'FOUND' && lookup.status !== 'NOT_CONFIGURED') {
      return failure({
        code: `BYOK_${lookup.status}`,
        message: 'Unable to load stored BYOK credentials',
      });
    }
  }

  const falKey = falLookup.status === 'FOUND' ? falLookup.key : null;
  const replicateKey = replicateLookup.status === 'FOUND' ? replicateLookup.key : null;

  for (const candidate of ranked) {
    if (candidate.aggregator === 'fal-ai' && falKey) {
      const res = await submitFalVideoJob(falKey, candidate.modelId, request);
      if (res.ok) return res;
    }
    if (candidate.aggregator === 'replicate' && replicateKey) {
      const res = await submitReplicateVideoJob(replicateKey, candidate.modelId, request);
      if (res.ok) return res;
    }
  }

  if (!falKey && !replicateKey) {
    return failure({ code: 'BYOK_KEY_MISSING', message: 'No fal-ai or replicate BYOK key found for user' });
  }

  return failure({ code: 'ALL_PROVIDERS_FAILED', message: 'All candidate models/providers failed' });
}
