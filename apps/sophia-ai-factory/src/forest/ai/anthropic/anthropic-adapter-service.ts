/**
 * @module forest/ai/anthropic/anthropic-adapter-service
 * Full and simple message execution service for Anthropic API.
 */

import type { ChatMessage, ChatOptions } from '@/seed/ai/provider-interface';
import { AnthropicProvider } from './anthropic-provider';
import {
  API_URL,
  type CallAnthropicParams,
  type AnthropicResponse,
} from './types';
import { buildHeaders } from './client-factory';
import { buildBody, httpError } from './error-classifier';

/**
 * Full call: returns full response (for tool-use + multi-block).
 */
export async function callAnthropicFull(
  params: CallAnthropicParams,
): Promise<AnthropicResponse> {
  if (!params.apiKey) {
    throw new Error('ANTHROPIC_MISSING_API_KEY: apiKey is required');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: buildHeaders(params.apiKey),
    body: buildBody(params, false),
  });

  if (!response.ok) await httpError(response);

  const data = (await response.json()) as AnthropicResponse;
  if (!data.content || data.content.length === 0) {
    throw new Error('ANTHROPIC_EMPTY_RESPONSE: content array is empty');
  }
  return data;
}

/**
 * Simple call: returns first text block.
 * Delegates to AnthropicProvider.
 */
export async function callAnthropic(params: CallAnthropicParams): Promise<string> {
  if (!params.apiKey) {
    throw new Error('ANTHROPIC_MISSING_API_KEY: apiKey is required');
  }

  const provider = new AnthropicProvider({ apiKey: params.apiKey });
  const chatMessages: ChatMessage[] = [];
  if (params.system) {
    chatMessages.push({ role: 'system', content: params.system });
  }
  for (const m of params.messages) {
    chatMessages.push({ role: m.role as ChatMessage['role'], content: m.content });
  }

  try {
    const response = await provider.chat(chatMessages, {
      model: params.model,
      apiKey: params.apiKey,
      maxTokens: params.maxTokens,
      timeoutMs: 120_000,
    } as ChatOptions);
    if (!response.content) {
      throw new Error('ANTHROPIC_EMPTY_RESPONSE: content array has no text block');
    }
    return response.content;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const normalized = message.replace(/^Anthropic HTTP (\d+)/, 'ANTHROPIC_HTTP_$1');
    throw new Error(normalized);
  }
}
