/**
 * @module forest/ai/anthropic/client-factory
 * Anthropic request headers, message formatting, capability lookup, and error classification.
 */

import type {
  ChatMessage,
  ProviderCapabilities,
} from '@/seed/ai/provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import { API_VERSION } from './types';

/**
 * Static capabilities per Anthropic model family.
 */
export function getCapabilitiesForModel(model: string): ProviderCapabilities {
  const lower = model.toLowerCase();

  const base: ProviderCapabilities = {
    streaming: true,
    systemRole: true,
    maxOutputTokens: 8192,
    maxInputTokens: 200_000,
    functionCalling: true,
    vision: true,
  };

  if (lower.includes('haiku')) {
    return { ...base, maxOutputTokens: 4096, maxInputTokens: 200_000 };
  }
  if (lower.includes('opus')) {
    return { ...base, maxOutputTokens: 32_000, maxInputTokens: 200_000 };
  }
  if (lower.includes('claude-3-5-haiku')) {
    return { ...base, maxOutputTokens: 4096, maxInputTokens: 100_000 };
  }

  return base;
}

/**
 * Build the Anthropic Messages API headers.
 */
export function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': API_VERSION,
    'content-type': 'application/json',
  };
}

/**
 * Normalise provider-agnostic ChatMessage[] into Anthropic format.
 */
export function normaliseMessages(
  messages: ChatMessage[],
): { system?: string; apiMessages: Array<{ role: string; content: string }> } {
  const systemParts: string[] = [];
  const apiMessages: Array<{ role: string; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
    } else {
      apiMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n') : undefined,
    apiMessages,
  };
}

/**
 * Create an AbortSignal that fires after the given timeout.
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Classifies HTTP status and annotates retryability on the created Error.
 */
export function classifyAnthropicError(status: number, errorBody: string): Error {
  const error = new Error(`Anthropic HTTP ${status}: ${errorBody.slice(0, 300)}`);
  const annotated = error as { status?: number; retryable?: boolean; code?: string };
  annotated.status = status;

  if (status === 401 || status === 403) {
    annotated.retryable = false;
    annotated.code = 'INVALID_KEY';
  } else if (status === 429 || status === 402) {
    annotated.retryable = true;
    annotated.code = 'RATE_LIMITED';
  } else if (status >= 500) {
    annotated.retryable = true;
    annotated.code = 'SERVER_ERROR';
  } else {
    annotated.retryable = false;
  }

  logger.warn('[AnthropicProvider] Request failed', undefined, {
    status,
    retryable: annotated.retryable,
    code: annotated.code,
  });

  return error;
}
