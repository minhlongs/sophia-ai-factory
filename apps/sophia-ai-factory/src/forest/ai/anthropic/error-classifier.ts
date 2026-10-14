/**
 * @module forest/ai/anthropic/error-classifier
 * HTTP request serialization and error classification for Anthropic API.
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  ProviderQuotaExceededError,
  ProviderInvalidKeyError,
} from '@/seed/services/errors';
import {
  DEFAULT_MAX_TOKENS,
  ERROR_BODY_MAX_LEN,
  type CallAnthropicParams,
} from './types';

export function buildBody(params: CallAnthropicParams, stream: boolean): string {
  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: params.messages,
  };
  if (params.system) body.system = params.system;
  if (params.tools && params.tools.length > 0) body.tools = params.tools;
  if (stream) body.stream = true;
  return JSON.stringify(body);
}

export async function httpError(response: Response): Promise<never> {
  const raw = await response.text().catch((err) => {
    logger.warn('Failed to read Anthropic error response body', undefined, {
      error: String(err),
      context: 'httpError',
    });
    return '';
  });

  const body =
    raw.length > ERROR_BODY_MAX_LEN
      ? `${raw.slice(0, ERROR_BODY_MAX_LEN)}...[truncated]`
      : raw;

  if (response.status === 401 || response.status === 403) {
    throw new ProviderInvalidKeyError('anthropic', body);
  }
  if (response.status === 429 || response.status === 402) {
    throw new ProviderQuotaExceededError('anthropic', body);
  }
  throw new Error(`ANTHROPIC_HTTP_${response.status}: ${body}`);
}
