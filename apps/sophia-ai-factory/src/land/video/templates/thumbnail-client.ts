/**
 * Thumbnail Generation Client
 *
 * Wraps the OpenAI Images API (gpt-image-1) for AI thumbnail generation.
 * Endpoint: https://api.openai.com/v1/images/generations
 *
 * Synchronous-style: sends request and waits for image URL.
 * Default size 1792x1024 (landscape for YouTube thumbnails).
 *
 * Handles: 429 (rate limit), 400 (content policy), 401 (auth).
 * Uses AbortController with configurable timeout (default 60s).
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  ThumbnailClientError,
  throwThumbnailResponseError,
  type OpenAIImageResponse,
  type ThumbnailClientConfig,
  type ThumbnailGenerateParams,
  type ThumbnailGenerateResult,
} from './thumbnail-client-types';

export {
  ThumbnailClientError,
  type ThumbnailClientConfig,
  type ThumbnailGenerateParams,
  type ThumbnailGenerateResult,
};

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT_MS = 60_000; // 60s — image gen is slower than text

export class ThumbnailClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor({ apiKey, baseUrl, timeoutMs }: ThumbnailClientConfig) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Generate a thumbnail image from a text prompt.
   * Returns imageUrl and optional revisedPrompt from the model.
   */
  async generateThumbnail(params: ThumbnailGenerateParams): Promise<ThumbnailGenerateResult> {
    const {
      prompt,
      size = '1792x1024',
      quality = 'hd',
      style = 'vivid',
    } = params;

    if (!shouldAllowRequest('openai')) {
      throw new ThumbnailClientError(
        0,
        '[ThumbnailClient] Circuit breaker open for openai — too many failures',
      );
    }

    logger.info('[ThumbnailClient] Generating thumbnail', { size, quality, style });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt,
          n: 1,
          size,
          quality,
          style,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        await throwThumbnailResponseError(response);
      }

      recordSuccess('openai');
      const output = (await response.json()) as OpenAIImageResponse;

      const imageData = output.data?.[0];
      const imageUrl = imageData?.url;
      if (!imageUrl) {
        throw new ThumbnailClientError(0, '[ThumbnailClient] No image URL in response');
      }

      logger.info('[ThumbnailClient] Thumbnail generated', {
        imageUrl: imageUrl.slice(0, 60) + '…',
      });

      return {
        imageUrl,
        revisedPrompt: imageData.revised_prompt,
      };
    } catch (err) {
      const kind = classifyError(err);
      recordFailure('openai', kind);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
