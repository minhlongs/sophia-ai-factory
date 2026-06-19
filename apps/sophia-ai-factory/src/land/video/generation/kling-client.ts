/**
 * Kling 3.0 Video Client
 *
 * Wraps the fal.ai queue-based API for Kling v2 master text-to-video generation.
 * Endpoint: https://queue.fal.run/fal-ai/kling-video/v2/master/text-to-video
 *
 * Handles: rate limit (429), payment required (402), invalid prompt (400).
 * Uses AbortController with configurable timeout (default 5 min).
 *
 * Note: Direct Kuaishou API requires Chinese business registration.
 * fal.ai is the recommended aggregator (same pattern as Fish Speech).
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  VideoGenerateParams,
  VideoGenerateResult,
  ProviderVideoJobStatus,
  KlingApiInput,
  KlingApiResponse,
  KlingJobStatusResponse,
} from '../templates/types';

const DEFAULT_BASE_URL = 'https://queue.fal.run/fal-ai/kling-video/v2/master/text-to-video';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class KlingVideoClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'KlingVideoClientError';
  }
}

export interface KlingVideoClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class KlingVideoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor({ apiKey, baseUrl, timeoutMs }: KlingVideoClientConfig) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Submit a video generation job via fal.ai queue.
   * Returns immediately with requestId + initial status.
   */
  async generateVideo(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const input: KlingApiInput = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio ?? '16:9',
      duration: params.duration ?? 5,
    };

    logger.info('[KlingVideoClient] Submitting video generation', {
      aspectRatio: input.aspect_ratio,
      duration: input.duration,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const result = (await response.json()) as KlingApiResponse;

      logger.info('[KlingVideoClient] Job submitted', {
        jobId: result.request_id,
        status: result.status,
      });

      return {
        jobId: result.request_id,
        // fal.ai queue returns 'IN_QUEUE' on submit; map to 'starting'
        status: 'starting',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Poll job status by request id.
   */
  async getJobStatus(jobId: string): Promise<ProviderVideoJobStatus> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/requests/${jobId}/status`, {
        headers: {
          Authorization: `Key ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const statusResult = (await response.json()) as KlingJobStatusResponse;

      // fal.ai statuses: IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED
      const falStatus = statusResult.status;

      if (falStatus === 'COMPLETED') {
        // Fetch the actual result
        const resultResponse = await fetch(`${this.baseUrl}/requests/${jobId}`, {
          headers: { Authorization: `Key ${this.apiKey}` },
          signal: controller.signal,
        });

        if (!resultResponse.ok) {
          await this.handleErrorResponse(resultResponse);
        }

        const resultData = (await resultResponse.json()) as { video?: { url: string }; error?: string };
        return {
          status: 'succeeded',
          videoUrl: resultData.video?.url,
          error: resultData.error,
        };
      }

      if (falStatus === 'FAILED') {
        return {
          status: 'failed',
          error: statusResult.error ?? 'Kling generation failed',
        };
      }

      // IN_QUEUE → starting, IN_PROGRESS → processing
      const mappedStatus = falStatus === 'IN_PROGRESS' ? 'processing' : 'starting';
      return { status: mappedStatus };
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const body = await response.text().catch(() => '');
    const code = response.status;

    if (code === 429) {
      throw new KlingVideoClientError(429, `[KlingVideoClient] Rate limit exceeded: ${body}`);
    }
    if (code === 402) {
      throw new KlingVideoClientError(402, `[KlingVideoClient] Payment required — check fal.ai credits: ${body}`);
    }
    if (code === 400) {
      throw new KlingVideoClientError(400, `[KlingVideoClient] Invalid prompt or parameters: ${body}`);
    }
    throw new KlingVideoClientError(code, `[KlingVideoClient] API error ${code}: ${body}`);
  }
}
