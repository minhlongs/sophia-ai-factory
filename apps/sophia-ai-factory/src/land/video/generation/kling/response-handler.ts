/**
 * HTTP Error Response Handler for Kling API
 *
 * @module land/video/generation/kling/response-handler
 */

import { logger } from '@/seed/utils/logger-utility';
import { KlingVideoClientError } from './types';

export async function handleKlingErrorResponse(
  response: Response,
): Promise<never> {
  const body = await response.text().catch((err) => {
    logger.warn('Failed to read response body', {
      error: String(err),
      context: 'handleKlingErrorResponse',
    });
    return '';
  });
  const code = response.status;

  if (code === 429) {
    throw new KlingVideoClientError(
      429,
      `[KlingVideoClient] Rate limit exceeded: ${body}`,
    );
  }
  if (code === 402) {
    throw new KlingVideoClientError(
      402,
      `[KlingVideoClient] Payment required — check fal.ai credits: ${body}`,
    );
  }
  if (code === 400) {
    throw new KlingVideoClientError(
      400,
      `[KlingVideoClient] Invalid prompt or parameters: ${body}`,
    );
  }
  throw new KlingVideoClientError(
    code,
    `[KlingVideoClient] API error ${code}: ${body}`,
  );
}
