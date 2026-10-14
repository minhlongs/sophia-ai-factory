/**
 * Wan 2.1 Video Client Error & Helper Utilities
 *
 * @module land/video/generation/wan21-client-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import type { WanApiPrediction } from '../templates/types';

export const DEFAULT_WAN_MODEL = 'wan-video/wan-2.1';
export const DEFAULT_WAN_BASE_URL = 'https://api.replicate.com/v1';
export const DEFAULT_WAN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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

export function extractWanVideoUrl(output: WanApiPrediction['output']): string | undefined {
  if (output == null) return undefined;
  return Array.isArray(output) ? output[0] : output;
}

export async function throwWanErrorResponse(response: Response): Promise<never> {
  const body = await response.text().catch((err) => {
    logger.warn('Failed to read Wan21 error response', {
      error: String(err),
      context: 'WanVideoClient.handleErrorResponse',
    });
    return '';
  });
  const code = response.status;

  if (code === 429) {
    throw new WanVideoClientError(429, `[WanVideoClient] Rate limit exceeded: ${body}`);
  }
  if (code === 402) {
    throw new WanVideoClientError(
      402,
      `[WanVideoClient] Payment required — check Replicate credits: ${body}`,
    );
  }
  if (code === 400) {
    throw new WanVideoClientError(400, `[WanVideoClient] Invalid prompt or parameters: ${body}`);
  }
  throw new WanVideoClientError(code, `[WanVideoClient] API error ${code}: ${body}`);
}
