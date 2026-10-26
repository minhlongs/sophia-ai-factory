/**
 * @module tree/video/providers/unified-video-router
 * Unified BYOK Video Router with Circuit Breaker and automatic failover.
 */

import { getUserApiKey } from '@/tree/byok/user-api-key-store';
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

  const falKey = await getUserApiKey(request.userId, 'fal-ai');
  const replicateKey = await getUserApiKey(request.userId, 'replicate');

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
