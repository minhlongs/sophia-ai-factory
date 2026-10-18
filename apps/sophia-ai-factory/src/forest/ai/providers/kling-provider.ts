/**
 * @module forest/ai/providers/kling-provider
 * Kling AI Video Client.
 * Layer: forest — imports seed only.
 */

import {
  type IVideoRenderingProvider,
  type VideoRenderInput,
  type VideoRenderStatus,
} from '@/seed/ai/multimodal-provider-interface';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';
import { pollKlingJobStatus, resolveKlingRenderParams } from './kling-status-poller';

export { KlingVideoAdapter } from './kling-video-adapter';

export interface KlingVideoClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  keyRef?: string;
}

export class KlingVideoClient implements IVideoRenderingProvider {
  readonly id = 'kling';
  readonly label = 'Kling AI Video';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly keyRef: string;

  constructor(config: KlingVideoClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://queue.fal.run/fal-ai/kling-video/v2/master/text-to-video').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 5 * 60 * 1000;
    this.keyRef = config.keyRef ?? 'platform';
  }

  async generateVideo(params: { prompt: string; aspectRatio?: string; duration?: number }): Promise<{ jobId: string; status: string }> {
    if (!params.prompt || !params.prompt.trim()) {
      throw new Error('[KlingVideoClient] prompt is required and cannot be empty');
    }
    if (!shouldAllowRequest('kling', this.keyRef)) {
      throw new Error(`[Kling] Circuit breaker open for kling (${this.keyRef})`);
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { Authorization: `Key ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          aspect_ratio: params.aspectRatio ?? '16:9',
          duration: params.duration ?? 5,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        recordFailure('kling', classifyHttpStatus(response.status), this.keyRef);
        throw new Error(`Kling video generation failed: ${response.status} - ${errText}`);
      }

      const result = (await response.json()) as { request_id?: string; id?: string; status?: string };
      recordSuccess('kling', this.keyRef);
      const jobId = result.request_id || result.id || `kling_${Date.now()}`;
      return { jobId, status: result.status || 'starting' };
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('Circuit breaker'))) {
        recordFailure('kling', classifyError(err), this.keyRef);
      }
      throw err;
    }
  }

  async getJobStatus(jobId: string): Promise<VideoRenderStatus> {
    return this.checkStatus(jobId);
  }

  async renderVideo(input: VideoRenderInput, keyRefOverride?: string): Promise<{ jobId: string }> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    if (!shouldAllowRequest('kling', effectiveKeyRef)) {
      throw new Error(`[Kling] Circuit breaker open for kling (${effectiveKeyRef})`);
    }

    const { prompt, duration, aspectRatio } = resolveKlingRenderParams(input);
    const result = await this.generateVideo({ prompt, duration, aspectRatio });
    return { jobId: result.jobId };
  }

  async checkStatus(jobId: string, keyRefOverride?: string): Promise<VideoRenderStatus> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    return pollKlingJobStatus({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      jobId,
      effectiveKeyRef,
    });
  }

  async health(keyRefOverride?: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    return { healthy: shouldAllowRequest('kling', effectiveKeyRef) };
  }
}
