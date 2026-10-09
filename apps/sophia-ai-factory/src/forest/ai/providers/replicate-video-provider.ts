/**
 * @module forest/ai/providers/replicate-video-provider
 * Replicate Video rendering provider using Wav2Lip / Cog.
 *
 * Layer: forest — imports seed only.
 */

import {
  type IVideoRenderingProvider,
  type VideoRenderInput,
  type VideoRenderStatus,
} from '@/seed/ai/multimodal-provider-interface';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';

export class ReplicateVideoRenderingProvider implements IVideoRenderingProvider {
  readonly id = 'replicate';
  readonly label = 'Replicate Video Rendering';
  private readonly apiKey: string;
  private readonly keyRef: string;
  private readonly baseUrl: string;
  private readonly modelOwner: string;
  private readonly modelName: string;

  constructor(options: {
    apiKey: string;
    keyRef: string;
    baseUrl?: string;
    modelOwner?: string;
    modelName?: string;
  }) {
    this.apiKey = options.apiKey;
    this.keyRef = options.keyRef;
    this.baseUrl = (options.baseUrl ?? 'https://api.replicate.com/v1').replace(/\/+$/, '');
    this.modelOwner = options.modelOwner ?? 'devxpy';
    this.modelName = options.modelName ?? 'cog-wav2lip';
  }

  async renderVideo(input: VideoRenderInput, keyRefOverride?: string): Promise<{ jobId: string }> {
    if (!input.faceUrl || !input.faceUrl.trim()) {
      throw new Error('[ReplicateVideoRenderingProvider] faceUrl is required and cannot be empty');
    }
    if (!input.audioUrl || !input.audioUrl.trim()) {
      throw new Error('[ReplicateVideoRenderingProvider] audioUrl is required and cannot be empty');
    }

    const effectiveKeyRef = keyRefOverride || this.keyRef;
    if (!shouldAllowRequest('replicate', effectiveKeyRef)) {
      throw new Error(`[Replicate] Circuit breaker open for replicate (${effectiveKeyRef})`);
    }

    let failureRecorded = false;
    try {
      const response = await fetch(
        `${this.baseUrl}/models/${this.modelOwner}/${this.modelName}/predictions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
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
        recordFailure('replicate', classifyHttpStatus(response.status), effectiveKeyRef);
        failureRecorded = true;
        throw new Error(`Replicate renderVideo failed: ${response.status} - ${errorText}`);
      }

      const prediction = (await response.json()) as { id: string };
      recordSuccess('replicate', effectiveKeyRef);
      return { jobId: prediction.id };
    } catch (err) {
      if (!failureRecorded && !(err instanceof Error && err.message.includes('Circuit breaker'))) {
        recordFailure('replicate', classifyError(err), effectiveKeyRef);
      }
      throw err;
    }
  }

  async checkStatus(jobId: string, keyRefOverride?: string): Promise<VideoRenderStatus> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    if (!shouldAllowRequest('replicate', effectiveKeyRef)) {
      throw new Error(`[Replicate] Circuit breaker open for replicate (${effectiveKeyRef})`);
    }

    let failureRecorded = false;
    try {
      const response = await fetch(`${this.baseUrl}/predictions/${jobId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        recordFailure('replicate', classifyHttpStatus(response.status), effectiveKeyRef);
        failureRecorded = true;
        throw new Error(`Replicate checkStatus failed: ${response.status} - ${errorText}`);
      }

      const prediction = (await response.json()) as {
        id: string;
        status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
        output?: string | string[];
        error?: string;
      };

      recordSuccess('replicate', effectiveKeyRef);

      const statusMap: Record<string, VideoRenderStatus['status']> = {
        starting: 'pending',
        processing: 'processing',
        succeeded: 'completed',
        failed: 'failed',
        canceled: 'failed',
      };

      const videoUrl = Array.isArray(prediction.output)
        ? prediction.output[0]
        : (prediction.output ?? undefined);

      return {
        status: statusMap[prediction.status] ?? 'pending',
        videoUrl,
        error: prediction.error,
      };
    } catch (err) {
      if (!failureRecorded && !(err instanceof Error && err.message.includes('Circuit breaker'))) {
        recordFailure('replicate', classifyError(err), effectiveKeyRef);
      }
      throw err;
    }
  }

  async health(keyRefOverride?: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    const healthy = shouldAllowRequest('replicate', effectiveKeyRef);
    return { healthy };
  }
}
