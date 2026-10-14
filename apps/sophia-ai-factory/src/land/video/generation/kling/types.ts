/**
 * Kling Video Client Types and Errors
 *
 * @module land/video/generation/kling/types
 */

export const DEFAULT_BASE_URL =
  'https://queue.fal.run/fal-ai/kling-video/v2/master/text-to-video';
export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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
