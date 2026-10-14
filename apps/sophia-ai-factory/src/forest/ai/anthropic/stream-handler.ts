/**
 * @module forest/ai/anthropic/stream-handler
 * SSE streaming generator handlers for Anthropic API.
 */

import {
  parseAnthropicSse,
  type AnthropicStreamEvent,
} from '@/seed/ai/anthropic-sse-parser';
import { API_URL, type CallAnthropicParams } from './types';
import { buildHeaders } from './client-factory';
import { buildBody, httpError } from './error-classifier';

/**
 * Streaming: yields structured events (text + tool_use).
 */
export async function* callAnthropicStreamEvents(
  params: CallAnthropicParams,
): AsyncGenerator<AnthropicStreamEvent, void, unknown> {
  if (!params.apiKey) {
    throw new Error('ANTHROPIC_MISSING_API_KEY: apiKey is required');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: buildHeaders(params.apiKey),
    body: buildBody(params, true),
  });

  if (!response.ok) await httpError(response);
  if (!response.body) {
    throw new Error('ANTHROPIC_NO_STREAM_BODY: response body is null');
  }

  const reader = response.body.getReader();
  yield* parseAnthropicSse(reader);
}

/**
 * Streaming (text-only convenience): yields text_delta strings.
 */
export async function* callAnthropicStream(
  params: CallAnthropicParams,
): AsyncGenerator<string, void, unknown> {
  for await (const event of callAnthropicStreamEvents(params)) {
    if (event.type === 'text_delta') yield event.text;
  }
}
