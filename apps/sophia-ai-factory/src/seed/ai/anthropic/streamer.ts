import { parseAnthropicSse, type AnthropicStreamEvent } from '../anthropic-sse-parser';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus } from '@/seed/types/failure-kind';
import { API_URL, SERVICE_NAME, CallAnthropicParams } from './types';
import { buildBody, buildHeaders, handleAnthropicHttpError } from './client-helpers';

// ── Streaming: yields structured events (text + tool_use) ────────────────────

export async function* callAnthropicStreamEvents(
  params: CallAnthropicParams,
): AsyncGenerator<AnthropicStreamEvent, void, unknown> {
  if (!params.apiKey) {
    throw new Error('ANTHROPIC_MISSING_API_KEY: apiKey is required');
  }

  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: buildHeaders(params.apiKey),
    body: buildBody(params, true),
  });

  if (!response.ok) {
    const kind = classifyHttpStatus(response.status);
    recordFailure(SERVICE_NAME, kind);
    await handleAnthropicHttpError(response);
  }
  recordSuccess(SERVICE_NAME);
  if (!response.body) {
    throw new Error('ANTHROPIC_NO_STREAM_BODY: response body is null');
  }

  const reader = response.body.getReader();
  yield* parseAnthropicSse(reader);
}

// ── Streaming (text-only convenience): yields text_delta strings ────────────

export async function* callAnthropicStream(
  params: CallAnthropicParams,
): AsyncGenerator<string, void, unknown> {
  for await (const event of callAnthropicStreamEvents(params)) {
    if (event.type === 'text_delta') yield event.text;
  }
}
