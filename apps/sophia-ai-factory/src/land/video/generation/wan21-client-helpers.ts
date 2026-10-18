/**
 * Wan 2.1 Video Client Error & Helper Utilities
 *
 * @module land/video/generation/wan21-client-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { VideoGenerateParams, WanApiInput, WanApiPrediction } from '../templates/types';

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

export function buildWanApiInput(params: VideoGenerateParams): WanApiInput {
  return {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio ?? '16:9',
    duration: params.duration ?? 5,
    ...(params.seed !== undefined ? { seed: params.seed } : {}),
  };
}

export async function executeWanRequest(
  url: string,
  apiKey: string,
  timeoutMs: number,
  options: { method?: string; body?: string } = {},
): Promise<WanApiPrediction> {
  if (!shouldAllowRequest('wan21')) {
    throw new WanVideoClientError(0, 'Circuit breaker open for Wan 2.1 — too many failures');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...(options.method ? { method: options.method } : {}),
      headers,
      ...(options.body ? { body: options.body } : {}),
      signal: controller.signal,
    });

    if (!response.ok) {
      await throwWanErrorResponse(response);
    }

    const prediction = (await response.json()) as WanApiPrediction;
    recordSuccess('wan21');
    return prediction;
  } catch (error) {
    if (error instanceof WanVideoClientError) throw error;
    const kind = classifyError(error);
    recordFailure('wan21', kind);
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
