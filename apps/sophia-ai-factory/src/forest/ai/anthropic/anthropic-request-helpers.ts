/**
 * Request body builder and HTTP execution helpers for AnthropicProvider.
 * @module forest/ai/anthropic/anthropic-request-helpers
 */

import type { ChatMessage, ChatOptions } from '@/seed/ai/provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import {
  API_URL,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TIMEOUT_MS,
} from './types';
import {
  buildHeaders,
  normaliseMessages,
  createTimeoutSignal,
  classifyAnthropicError,
} from './client-factory';

export function buildAnthropicRequestBody(
  messages: ChatMessage[],
  options: ChatOptions,
  stream: boolean,
): { model: string; body: Record<string, unknown> } {
  const model = options.model ?? DEFAULT_MODEL;
  const { system, apiMessages } = normaliseMessages(messages);

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: apiMessages,
  };
  if (stream) body.stream = true;
  if (system) body.system = system;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.topP !== undefined) body.top_p = options.topP;
  if (options.stop && options.stop.length > 0) body.stop_sequences = options.stop;
  if (!stream) {
    if (options.seed !== undefined) body.seed = options.seed;
    if (options.responseFormat) body.response_format = options.responseFormat;
    if (options.extraBody) Object.assign(body, options.extraBody);
  }

  return { model, body };
}

export async function postAnthropicMessagesRequest(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number | undefined,
  context: string,
): Promise<Response> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
    signal: createTimeoutSignal(timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch (err) {
      logger.warn(`Failed to read Anthropic error response body (${context})`, undefined, {
        error: String(err),
        context,
      });
    }
    throw classifyAnthropicError(response.status, errorBody);
  }

  return response;
}
