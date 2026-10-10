import type { ChatMessage, ChatOptions, ProviderCapabilities } from '@/seed/ai/provider-interface';
import { DEFAULT_MODEL, DEFAULT_MAX_TOKENS } from './types';

/**
 * Static capabilities per model family.
 */
export function getCapabilitiesForModel(model: string): ProviderCapabilities {
  const lower = model.toLowerCase();

  const base: ProviderCapabilities = {
    streaming: true,
    systemRole: true,
    maxOutputTokens: 8192,
    maxInputTokens: 128_000,
    functionCalling: true,
    vision: lower.includes('vision') || lower.includes('gpt-4o') || lower.includes('gemini'),
  };

  if (lower.includes('gpt-4o-mini') || lower.includes('haiku')) {
    return { ...base, maxOutputTokens: 4096, maxInputTokens: 128_000 };
  }
  if (lower.includes('o3') || lower.includes('o4-mini')) {
    return { ...base, maxOutputTokens: 100_000, maxInputTokens: 200_000 };
  }
  if (lower.includes('gemini-2-5-pro')) {
    return { ...base, maxOutputTokens: 8192, maxInputTokens: 1_048_576 };
  }
  if (lower.includes('llama-4-maverick') || lower.includes('llama-4-scout')) {
    return { ...base, maxOutputTokens: 4096, maxInputTokens: 131_072, functionCalling: false };
  }

  return base;
}

/**
 * Build the OpenAI-compatible request body.
 */
export function buildRequestBody(
  messages: ChatMessage[],
  options: ChatOptions,
  stream: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model ?? DEFAULT_MODEL,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    })),
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? 0.3,
    stream,
  };

  if (options.topP !== undefined) body.top_p = options.topP;
  if (options.stop && options.stop.length > 0) body.stop = options.stop;
  if (options.seed !== undefined) body.seed = options.seed;
  if (options.responseFormat) body.response_format = options.responseFormat;
  if (options.extraBody) {
    Object.assign(body, options.extraBody);
  }

  return body;
}

/**
 * Create an AbortSignal that fires after the given timeout.
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}
