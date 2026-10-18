/**
 * Thumbnail Generation Client — Types & HTTP Error Mapping
 * Layer: land/video/templates
 */

import { logger } from '@/seed/utils/logger-utility';

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

export interface OpenAIImageResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

export async function throwThumbnailResponseError(response: Response): Promise<never> {
  const body = await response.text().catch((err) => {
    logger.warn('Failed to read response body', {
      error: String(err),
      context: 'handleErrorResponse',
    });
    return '';
  });
  const code = response.status;

  if (code === 429) {
    throw new ThumbnailClientError(429, `[ThumbnailClient] Rate limit exceeded: ${body}`);
  }
  if (code === 401) {
    throw new ThumbnailClientError(
      401,
      `[ThumbnailClient] Invalid or missing OpenAI API key: ${body}`,
    );
  }
  if (code === 400) {
    throw new ThumbnailClientError(
      400,
      `[ThumbnailClient] Invalid prompt or content policy violation: ${body}`,
    );
  }
  throw new ThumbnailClientError(code, `[ThumbnailClient] API error ${code}: ${body}`);
}
