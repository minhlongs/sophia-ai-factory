/**
 * Wan 2.1 Video Client — wraps Replicate API (wan-video/wan-2.1).
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type {
  VideoGenerateParams,
  VideoGenerateResult,
  ProviderVideoJobStatus,
  WanApiInput,
  WanApiPrediction,
} from '../templates/types';
import {
  DEFAULT_WAN_MODEL,
  DEFAULT_WAN_BASE_URL,
  DEFAULT_WAN_TIMEOUT_MS,
  WanVideoClientError,
  type WanVideoClientConfig,
  extractWanVideoUrl,
  throwWanErrorResponse,
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
    if (!shouldAllowRequest('wan21')) {
      throw new WanVideoClientError(0, 'Circuit breaker open for Wan 2.1 — too many failures');
    }

    const input: WanApiInput = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio ?? '16:9',
      duration: params.duration ?? 5,
      ...(params.seed !== undefined ? { seed: params.seed } : {}),
    };

    logger.info('[WanVideoClient] Submitting video generation', {
      model: this.model,
      aspectRatio: input.aspect_ratio,
      duration: input.duration,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/models/${this.model}/predictions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });

      if (!response.ok) {
        await throwWanErrorResponse(response);
      }

      const prediction = (await response.json()) as WanApiPrediction;

      logger.info('[WanVideoClient] Job submitted', {
        jobId: prediction.id,
        status: prediction.status,
      });

      recordSuccess('wan21');
      return {
        jobId: prediction.id,
        status: prediction.status,
      };
    } catch (error) {
      if (error instanceof WanVideoClientError) throw error;
      const kind = classifyError(error);
      recordFailure('wan21', kind);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Poll job status by prediction id.
   */
  async getJobStatus(jobId: string): Promise<ProviderVideoJobStatus> {
    if (!shouldAllowRequest('wan21')) {
      throw new WanVideoClientError(0, 'Circuit breaker open for Wan 2.1 — too many failures');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/predictions/${jobId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        await throwWanErrorResponse(response);
      }

      const prediction = (await response.json()) as WanApiPrediction;
      const videoUrl = extractWanVideoUrl(prediction.output);

      recordSuccess('wan21');
      return {
        status: prediction.status,
        videoUrl,
        error: prediction.error,
      };
    } catch (error) {
      if (error instanceof WanVideoClientError) throw error;
      const kind = classifyError(error);
      recordFailure('wan21', kind);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
