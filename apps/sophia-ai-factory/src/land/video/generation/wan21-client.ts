/**
 * Wan 2.1 Video Client
 *
 * Wraps the Replicate API for Wan 2.1 text-to-video generation.
 * Model: wan-video/wan-2.1 on https://replicate.com
 *
 * Handles: rate limit (429), payment required (402), invalid prompt (400).
 * Uses AbortController with configurable timeout (default 5 min).
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  VideoGenerateParams,
  VideoGenerateResult,
  ProviderVideoJobStatus,
  WanApiInput,
  WanApiPrediction,
} from '../templates/types';

const DEFAULT_MODEL = 'wan-video/wan-2.1';
const DEFAULT_BASE_URL = 'https://api.replicate.com/v1';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class WanVideoClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'WanVideoClientError';
  }
}

export interface WanVideoClientConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export class WanVideoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor({ apiKey, baseUrl, model, timeoutMs }: WanVideoClientConfig) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.model = model ?? DEFAULT_MODEL;
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Submit a video generation job.
   * Returns immediately with jobId + initial status.
   */
  async generateVideo(params: VideoGenerateParams): Promise<VideoGenerateResult> {
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
        await this.handleErrorResponse(response);
      }

      const prediction = (await response.json()) as WanApiPrediction;

      logger.info('[WanVideoClient] Job submitted', {
        jobId: prediction.id,
        status: prediction.status,
      });

      return {
        jobId: prediction.id,
        status: prediction.status,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Poll job status by prediction id.
   */
  async getJobStatus(jobId: string): Promise<ProviderVideoJobStatus> {
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
        await this.handleErrorResponse(response);
      }

      const prediction = (await response.json()) as WanApiPrediction;

      const videoUrl =
        prediction.output != null
          ? Array.isArray(prediction.output)
            ? prediction.output[0]
            : prediction.output
          : undefined;

      return {
        status: prediction.status,
        videoUrl,
        error: prediction.error,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const body = await response.text().catch(() => '');
    const code = response.status;

    if (code === 429) {
      throw new WanVideoClientError(429, `[WanVideoClient] Rate limit exceeded: ${body}`);
    }
    if (code === 402) {
      throw new WanVideoClientError(402, `[WanVideoClient] Payment required — check Replicate credits: ${body}`);
    }
    if (code === 400) {
      throw new WanVideoClientError(400, `[WanVideoClient] Invalid prompt or parameters: ${body}`);
    }
    throw new WanVideoClientError(code, `[WanVideoClient] API error ${code}: ${body}`);
  }
}
