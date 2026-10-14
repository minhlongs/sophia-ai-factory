import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  API_URL,
  SERVICE_NAME,
  AnthropicResponse,
  AnthropicTextBlock,
  CallAnthropicParams,
} from './types';
import { buildBody, buildHeaders, handleAnthropicHttpError } from './client-helpers';

// ── Full call: returns full response (for tool-use + multi-block) ───────────

export async function callAnthropicFull(params: CallAnthropicParams): Promise<AnthropicResponse> {
  if (!params.apiKey) {
    throw new Error('ANTHROPIC_MISSING_API_KEY: apiKey is required');
  }

  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: buildHeaders(params.apiKey),
    body: buildBody(params, false),
  });

  if (!response.ok) {
    const kind = classifyHttpStatus(response.status);
    recordFailure(SERVICE_NAME, kind);
    await handleAnthropicHttpError(response);
  }
  recordSuccess(SERVICE_NAME);

  const data = (await response.json()) as AnthropicResponse;
  if (!data.content || data.content.length === 0) {
    throw new Error('ANTHROPIC_EMPTY_RESPONSE: content array is empty');
  }
  return data;
}

// ── Simple call: returns first text block ────────────────────────────────────

export async function callAnthropic(params: CallAnthropicParams): Promise<string> {
  const data = await callAnthropicFull(params);
  const firstText = data.content.find((b): b is AnthropicTextBlock => b.type === 'text')?.text;
  if (!firstText) {
    throw new Error('ANTHROPIC_EMPTY_RESPONSE: content array has no text block');
  }
  return firstText;
}
