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

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT_MS = 60_000; // 60s — image gen is slower than text

export class ThumbnailClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ThumbnailClientError';
  }
}

export interface ThumbnailClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ThumbnailGenerateParams {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

export interface ThumbnailGenerateResult {
  imageUrl: string;
  revisedPrompt?: string;
}

interface OpenAIImageResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

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
        await this.handleErrorResponse(response);
      }

      const output = (await response.json()) as OpenAIImageResponse;

      const imageData = output.data?.[0];
      const imageUrl = imageData?.url;
      if (!imageUrl) {
        throw new ThumbnailClientError(0, '[ThumbnailClient] No image URL in response');
      }

      logger.info('[ThumbnailClient] Thumbnail generated', { imageUrl: imageUrl.slice(0, 60) + '…' });

      return {
        imageUrl,
        revisedPrompt: imageData.revised_prompt,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const body = await response.text().catch(() => '');
    const code = response.status;

    if (code === 429) {
      throw new ThumbnailClientError(429, `[ThumbnailClient] Rate limit exceeded: ${body}`);
    }
    if (code === 401) {
      throw new ThumbnailClientError(401, `[ThumbnailClient] Invalid or missing OpenAI API key: ${body}`);
    }
    if (code === 400) {
      throw new ThumbnailClientError(400, `[ThumbnailClient] Invalid prompt or content policy violation: ${body}`);
    }
    throw new ThumbnailClientError(code, `[ThumbnailClient] API error ${code}: ${body}`);
  }
}
