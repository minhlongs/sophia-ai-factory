/**
 * @module forest/ai/providers/hunyuan-provider
 * HunyuanVideo Runpod Client.
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

export { HunyuanVideoAdapter } from './hunyuan-video-adapter';

export interface HunyuanVideoClientConfig {
  apiKey: string;
  endpointId?: string;
  baseUrl?: string;
  timeoutMs?: number;
  keyRef?: string;
}

export class HunyuanVideoClient implements IVideoRenderingProvider {
  readonly id = 'hunyuan';
  readonly label = 'HunyuanVideo Runpod';
  private readonly apiKey: string;
  private readonly endpointId: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly keyRef: string;

  constructor(config: HunyuanVideoClientConfig) {
    this.apiKey = config.apiKey;
    this.endpointId = config.endpointId ?? process.env.RUNPOD_ENDPOINT_ID ?? 'hunyuan-video';
    this.baseUrl = (config.baseUrl ?? 'https://api.runpod.io/v2').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 10 * 60 * 1000;
    this.keyRef = config.keyRef ?? 'platform';
  }

  async generateVideo(params: {
    prompt: string;
    duration?: number;
  }): Promise<{ jobId: string; status: string }> {
    const res = await this.renderVideo({
      faceUrl: 'https://placeholder.vault/avatar.png',
      audioUrl: 'https://placeholder.vault/audio.mp3',
      script: params.prompt,
      options: { duration: params.duration },
    });
    return { jobId: res.jobId, status: 'starting' };
  }

  async getJobStatus(jobId: string): Promise<VideoRenderStatus> {
    return this.checkStatus(jobId);
  }

  async renderVideo(input: VideoRenderInput, keyRefOverride?: string): Promise<{ jobId: string }> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    if (!shouldAllowRequest('runpod', effectiveKeyRef)) {
      throw new Error(`[HunyuanVideo] Circuit breaker open for runpod (${effectiveKeyRef})`);
    }

    const prompt =
      input.script ||
      (input.options?.topic as string) ||
      (input.options?.scenes as Array<{ prompt?: string }>)?.[0]?.prompt ||
      'Cinematic photorealistic video';
    const duration = typeof input.options?.duration === 'number' ? input.options.duration : 30;

    try {
      const response = await fetch(`${this.baseUrl}/${this.endpointId}/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt,
            duration,
            face_url: input.faceUrl,
            audio_url: input.audioUrl,
            fps: 30,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        recordFailure('runpod', classifyHttpStatus(response.status), effectiveKeyRef);
        throw new Error(`Runpod HunyuanVideo failed: ${response.status} - ${errText}`);
      }

      const result = (await response.json()) as { id: string };
      recordSuccess('runpod', effectiveKeyRef);
      return { jobId: result.id };
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('Circuit breaker'))) {
        recordFailure('runpod', classifyError(err), effectiveKeyRef);
      }
      throw err;
    }
  }

  async checkStatus(jobId: string, keyRefOverride?: string): Promise<VideoRenderStatus> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    if (!shouldAllowRequest('runpod', effectiveKeyRef)) {
      throw new Error(`[HunyuanVideo] Circuit breaker open for runpod (${effectiveKeyRef})`);
    }

    try {
      const response = await fetch(`${this.baseUrl}/${this.endpointId}/status/${jobId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        const errText = await response.text();
        recordFailure('runpod', classifyHttpStatus(response.status), effectiveKeyRef);
        throw new Error(`Runpod checkStatus failed: ${response.status} - ${errText}`);
      }

      const result = (await response.json()) as {
        status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
        output?: { download_url?: string };
        error?: string;
      };

      recordSuccess('runpod', effectiveKeyRef);

      if (result.status === 'COMPLETED') {
        return { status: 'completed', videoUrl: result.output?.download_url };
      }
      if (result.status === 'FAILED' || result.status === 'CANCELLED') {
        return { status: 'failed', error: result.error || `Runpod job status: ${result.status}` };
      }
      return { status: result.status === 'IN_PROGRESS' ? 'processing' : 'pending' };
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('Circuit breaker'))) {
        recordFailure('runpod', classifyError(err), effectiveKeyRef);
      }
      throw err;
    }
  }

  async health(keyRefOverride?: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    const healthy = shouldAllowRequest('runpod', effectiveKeyRef);
    return { healthy };
  }
}

export const HunyuanVideo = HunyuanVideoClient;
export type HunyuanVideo = HunyuanVideoClient;
