/**
 * @module forest/ai/providers/replicate-video-http
 * Replicate Video HTTP execution helpers with circuit-breaker instrumentation.
 *
 * Layer: forest — imports seed only.
 */

import type {
  VideoRenderInput,
  VideoRenderStatus,
} from '@/seed/ai/multimodal-provider-interface';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';

export interface ReplicateEndpointConfig {
  apiKey: string;
  effectiveKeyRef: string;
  baseUrl: string;
  modelOwner: string;
  modelName: string;
}

const REPLICATE_STATUS_MAP: Record<string, VideoRenderStatus['status']> = {
  starting: 'pending',
  processing: 'processing',
  succeeded: 'completed',
  failed: 'failed',
  canceled: 'failed',
};

export async function createReplicatePrediction(
  cfg: ReplicateEndpointConfig,
  input: VideoRenderInput,
): Promise<{ jobId: string }> {
  if (!shouldAllowRequest('replicate', cfg.effectiveKeyRef)) {
    throw new Error(`[Replicate] Circuit breaker open for replicate (${cfg.effectiveKeyRef})`);
  }

  let failureRecorded = false;
  try {
    const response = await fetch(
      `${cfg.baseUrl}/models/${cfg.modelOwner}/${cfg.modelName}/predictions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            face: input.faceUrl,
            audio: input.audioUrl,
            ...(input.options ?? {}),
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      recordFailure('replicate', classifyHttpStatus(response.status), cfg.effectiveKeyRef);
      failureRecorded = true;
      throw new Error(`Replicate renderVideo failed: ${response.status} - ${errorText}`);
    }

    const prediction = (await response.json()) as { id: string };
    recordSuccess('replicate', cfg.effectiveKeyRef);
    return { jobId: prediction.id };
  } catch (err) {
    if (!failureRecorded && !(err instanceof Error && err.message.includes('Circuit breaker'))) {
      recordFailure('replicate', classifyError(err), cfg.effectiveKeyRef);
    }
    throw err;
  }
}

export async function getReplicatePredictionStatus(
  cfg: Pick<ReplicateEndpointConfig, 'apiKey' | 'effectiveKeyRef' | 'baseUrl'>,
  jobId: string,
): Promise<VideoRenderStatus> {
  if (!shouldAllowRequest('replicate', cfg.effectiveKeyRef)) {
    throw new Error(`[Replicate] Circuit breaker open for replicate (${cfg.effectiveKeyRef})`);
  }

  let failureRecorded = false;
  try {
    const response = await fetch(`${cfg.baseUrl}/predictions/${jobId}`, {
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      recordFailure('replicate', classifyHttpStatus(response.status), cfg.effectiveKeyRef);
      failureRecorded = true;
      throw new Error(`Replicate checkStatus failed: ${response.status} - ${errorText}`);
    }

    const prediction = (await response.json()) as {
      id: string;
      status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
      output?: string | string[];
      error?: string;
    };

    recordSuccess('replicate', cfg.effectiveKeyRef);

    const videoUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : (prediction.output ?? undefined);

    return {
      status: REPLICATE_STATUS_MAP[prediction.status] ?? 'pending',
      videoUrl,
      error: prediction.error,
    };
  } catch (err) {
    if (!failureRecorded && !(err instanceof Error && err.message.includes('Circuit breaker'))) {
      recordFailure('replicate', classifyError(err), cfg.effectiveKeyRef);
    }
    throw err;
  }
}
