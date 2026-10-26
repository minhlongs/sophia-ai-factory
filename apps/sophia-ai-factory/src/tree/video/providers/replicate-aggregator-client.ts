/**
 * @module tree/video/providers/replicate-aggregator-client
 * Secondary client for Replicate multi-model video generation & serverless FFmpeg fallback.
 */

import { success, failure, type Result } from '@/seed/types/result';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus } from '@/seed/types/failure-kind';
import type { VideoGenerationJobRequest, VideoGenerationJobResponse } from '@/seed/ai/video-model-radar-types';

const REPLICATE_BASE = 'https://api.replicate.com/v1/predictions';
const BREAKER_KEY = 'replicate';

export async function submitReplicateVideoJob(
  apiKey: string,
  modelId: string,
  request: VideoGenerationJobRequest,
): Promise<Result<VideoGenerationJobResponse, { code: string; message: string }>> {
  if (!shouldAllowRequest(BREAKER_KEY)) {
    return failure({ code: 'CIRCUIT_BREAKER_OPEN', message: 'Replicate circuit breaker open' });
  }

  try {
    const res = await fetch(REPLICATE_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: modelId,
        input: { prompt: request.prompt, aspect_ratio: request.aspectRatio, duration: request.durationSec },
      }),
    });

    if (!res.ok) {
      recordFailure(BREAKER_KEY, classifyHttpStatus(res.status));
      return failure({ code: `HTTP_${res.status}`, message: `Replicate request failed: ${res.status}` });
    }

    recordSuccess(BREAKER_KEY);
    const data = (await res.json()) as { id?: string; output?: string | string[] };
    const videoUrl = Array.isArray(data.output) ? data.output[0] : typeof data.output === 'string' ? data.output : undefined;
    return success({
      jobId: data.id ?? `rep_${Date.now()}`,
      aggregator: 'replicate',
      modelId,
      status: videoUrl ? 'COMPLETED' : 'QUEUED',
      videoUrl,
      estimatedCostUsd: Math.round(request.durationSec * 0.025 * 1000) / 1000,
    });
  } catch (err) {
    recordFailure(BREAKER_KEY, classifyHttpStatus(500));
    return failure({ code: 'NETWORK_ERROR', message: String(err) });
  }
}
