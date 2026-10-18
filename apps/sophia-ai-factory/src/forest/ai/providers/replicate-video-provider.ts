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
import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import {
  createReplicatePrediction,
  getReplicatePredictionStatus,
} from './replicate-video-http';

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

    return createReplicatePrediction(
      {
        apiKey: this.apiKey,
        effectiveKeyRef: keyRefOverride || this.keyRef,
        baseUrl: this.baseUrl,
        modelOwner: this.modelOwner,
        modelName: this.modelName,
      },
      input,
    );
  }

  async checkStatus(jobId: string, keyRefOverride?: string): Promise<VideoRenderStatus> {
    return getReplicatePredictionStatus(
      {
        apiKey: this.apiKey,
        effectiveKeyRef: keyRefOverride || this.keyRef,
        baseUrl: this.baseUrl,
      },
      jobId,
    );
  }

  async health(keyRefOverride?: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    const healthy = shouldAllowRequest('replicate', effectiveKeyRef);
    return { healthy };
  }
}
