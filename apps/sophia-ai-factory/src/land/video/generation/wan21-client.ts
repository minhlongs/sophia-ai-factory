/**
 * Wan 2.1 Video Client — wraps Replicate API (wan-video/wan-2.1).
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  VideoGenerateParams,
  VideoGenerateResult,
  ProviderVideoJobStatus,
} from '../templates/types';
import {
  DEFAULT_WAN_MODEL,
  DEFAULT_WAN_BASE_URL,
  DEFAULT_WAN_TIMEOUT_MS,
  type WanVideoClientConfig,
  extractWanVideoUrl,
  buildWanApiInput,
  executeWanRequest,
} from './wan21-client-helpers';

export { WanVideoClientError, type WanVideoClientConfig } from './wan21-client-helpers';

export class WanVideoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor({ apiKey, baseUrl, model, timeoutMs }: WanVideoClientConfig) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? DEFAULT_WAN_BASE_URL).replace(/\/$/, '');
    this.model = model ?? DEFAULT_WAN_MODEL;
    this.timeoutMs = timeoutMs ?? DEFAULT_WAN_TIMEOUT_MS;
  }

  /**
   * Submit a video generation job.
   * Returns immediately with jobId + initial status.
   */
  async generateVideo(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const input = buildWanApiInput(params);

    logger.info('[WanVideoClient] Submitting video generation', {
      model: this.model,
      aspectRatio: input.aspect_ratio,
      duration: input.duration,
    });

    const prediction = await executeWanRequest(
      `${this.baseUrl}/models/${this.model}/predictions`,
      this.apiKey,
      this.timeoutMs,
      {
        method: 'POST',
        body: JSON.stringify({ input }),
      },
    );

    logger.info('[WanVideoClient] Job submitted', {
      jobId: prediction.id,
      status: prediction.status,
    });

    return {
      jobId: prediction.id,
      status: prediction.status,
    };
  }

  /**
   * Poll job status by prediction id.
   */
  async getJobStatus(jobId: string): Promise<ProviderVideoJobStatus> {
    const prediction = await executeWanRequest(
      `${this.baseUrl}/predictions/${jobId}`,
      this.apiKey,
      this.timeoutMs,
    );

    const videoUrl = extractWanVideoUrl(prediction.output);

    return {
      status: prediction.status,
      videoUrl,
      error: prediction.error,
    };
  }
}
