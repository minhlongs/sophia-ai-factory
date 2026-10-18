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
import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { executeRunpodRender, executeRunpodStatusCheck } from './hunyuan-runpod-http';

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
    return executeRunpodRender(
      {
        apiKey: this.apiKey,
        endpointId: this.endpointId,
        baseUrl: this.baseUrl,
        effectiveKeyRef: keyRefOverride || this.keyRef,
      },
      input,
    );
  }

  async checkStatus(jobId: string, keyRefOverride?: string): Promise<VideoRenderStatus> {
    return executeRunpodStatusCheck(
      {
        apiKey: this.apiKey,
        endpointId: this.endpointId,
        baseUrl: this.baseUrl,
        effectiveKeyRef: keyRefOverride || this.keyRef,
      },
      jobId,
    );
  }

  async health(keyRefOverride?: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    const healthy = shouldAllowRequest('runpod', effectiveKeyRef);
    return { healthy };
  }
}

export const HunyuanVideo = HunyuanVideoClient;
export type HunyuanVideo = HunyuanVideoClient;
