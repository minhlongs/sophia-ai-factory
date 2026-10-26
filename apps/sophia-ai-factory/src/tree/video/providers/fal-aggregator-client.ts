/**
 * @module tree/video/providers/fal-aggregator-client
 * Unified client for fal.ai 2026-2027 video generation & serverless FFmpeg compose.
 */

import { success, failure, type Result } from '@/seed/types/result';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus } from '@/seed/types/failure-kind';
import type { VideoGenerationJobRequest, VideoGenerationJobResponse } from '@/seed/ai/video-model-radar-types';

const FAL_BASE = 'https://queue.fal.run';
const BREAKER_KEY = 'fal-ai';

export async function submitFalVideoJob(
  apiKey: string,
  modelId: string,
  request: VideoGenerationJobRequest,
): Promise<Result<VideoGenerationJobResponse, { code: string; message: string }>> {
  if (!shouldAllowRequest(BREAKER_KEY)) {
    return failure({ code: 'CIRCUIT_BREAKER_OPEN', message: 'fal.ai circuit breaker open' });
  }

  try {
    const res = await fetch(`${FAL_BASE}/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        aspect_ratio: request.aspectRatio,
        duration: request.durationSec,
      }),
    });

    if (!res.ok) {
      recordFailure(BREAKER_KEY, classifyHttpStatus(res.status));
      return failure({ code: `HTTP_${res.status}`, message: `fal.ai request failed with ${res.status}` });
    }

    recordSuccess(BREAKER_KEY);
    const data = (await res.json()) as { request_id?: string; video?: { url?: string } };
    return success({
      jobId: data.request_id ?? `fal_${Date.now()}`,
      aggregator: 'fal-ai',
      modelId,
      status: data.video?.url ? 'COMPLETED' : 'QUEUED',
      videoUrl: data.video?.url,
      estimatedCostUsd: Math.round(request.durationSec * 0.045 * 1000) / 1000,
    });
  } catch (err) {
    recordFailure(BREAKER_KEY, classifyHttpStatus(500));
    return failure({ code: 'NETWORK_ERROR', message: String(err) });
  }
}
