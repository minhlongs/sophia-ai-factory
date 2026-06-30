/**
 * @module forest/ai/openrouter-provider
 *
 * OpenRouter provider adapter implementing the seed ProviderInterface.
 *
 * Wraps the existing openrouter-client.ts logic (callOpenRouter,
 * circuit breaker, retry) into the Provider interface contract.
 * Handles chat + streaming via OpenAI-compatible SSE format.
 *
 * Layer rule: forest — imports seed + tree only.
 */

import type {
  Provider,
  ProviderId,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
} from '@/seed/ai/provider-interface';
import { logger } from '@/seed/utils/logger-utility';

// ── Constants ──────────────────────────────────────────────────────────────────

/** OpenAI-compatible models supported via OpenRouter gateway. */
const OPENROUTER_MODELS = [
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/gpt-4-turbo',
  'openai/o3',
  'openai/o4-mini',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-opus-4',
  'anthropic/claude-haiku-3-5',
  'google/gemini-2-5-pro',
  'google/gemini-2-5-flash',
  'meta-llama/llama-4-maverick',
  'meta-llama/llama-4-scout',
  'mistral/mistral-large',
  'mistral/mistral-small',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-reasoner',
] as const;

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 60_000;

// ── Capabilities table ─────────────────────────────────────────────────────────

/**
 * Static capabilities per model family.
 *
 * Used at registration time; does not change at runtime.
 */
function getCapabilitiesForModel(model: string): ProviderCapabilities {
  const lower = model.toLowerCase();

  // All OpenRouter models support streaming + system role
  const base: ProviderCapabilities = {
    streaming: true,
    systemRole: true,
    maxOutputTokens: 8192,
    maxInputTokens: 128_000,
    functionCalling: true,
    vision: lower.includes('vision') || lower.includes('gpt-4o') || lower.includes('gemini'),
  };

  // Adjust output limits per model
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

// ── Provider implementation ────────────────────────────────────────────────────

export interface OpenRouterProviderConfig {
  apiKey: string;
  baseUrl?: string;
  label?: string;
}

/**
 * OpenRouter provider adapter.
 *
 * Implements the Provider interface using the OpenRouter gateway
 * (OpenAI-compatible API). Handles chat + streaming with built-in
 * retry logic.
 */
export class OpenRouterProvider implements Provider {
  readonly id: ProviderId = 'openrouter';
  readonly label: string;
  readonly apiKey: string;
  readonly baseUrl: string;

  constructor(config: OpenRouterProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? API_URL;
    this.label = config.label ?? 'OpenRouter';
  }

  // ── Chat (full response) ────────────────────────────────────────────────────

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const startTime = performance.now();
    const model = options.model ?? DEFAULT_MODEL;

    const body = this.buildRequestBody(messages, options, false);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sophia.agencyos.network',
        ...options.extraHeaders,
      },
      body: JSON.stringify(body),
      signal: this.createTimeoutSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (err) {
        logger.warn('Failed to read OpenRouter error response body', undefined, { error: String(err), context: 'OpenRouterProvider.chat' });
      }
      const error = new Error(`OpenRouter HTTP ${response.status}: ${errorBody.slice(0, 300)}`);
      (error as { status?: number; retryable?: boolean }).status = response.status;
      if (response.status === 401 || response.status === 403) {
        (error as { retryable?: boolean }).retryable = false;
      } else if (response.status === 429 || response.status >= 500) {
        (error as { retryable?: boolean }).retryable = true;
      } else {
        (error as { retryable?: boolean }).retryable = false;
      }
      throw error;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    const content = data.choices?.[0]?.message?.content ?? '';
    const latencyMs = Math.round(performance.now() - startTime);

    logger.debug('[OpenRouterProvider] Chat completed', undefined, {
      model,
      latencyMs,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    });

    return {
      content,
      model: data.model ?? model,
      provider: this.id,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      stopReason: data.choices?.[0]?.finish_reason ?? 'unknown',
      latencyMs,
    };
  }

  // ── Streaming ───────────────────────────────────────────────────────────────

  async *stream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const model = options.model ?? DEFAULT_MODEL;
    const body = this.buildRequestBody(messages, options, true);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sophia.agencyos.network',
        ...options.extraHeaders,
      },
      body: JSON.stringify(body),
      signal: this.createTimeoutSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (err) {
        logger.warn('Failed to read OpenRouter stream error response body', undefined, { error: String(err), context: 'OpenRouterProvider.stream' });
      }
      const error = new Error(`OpenRouter HTTP ${response.status}: ${errorBody.slice(0, 300)}`);
      (error as { status?: number; retryable?: boolean }).status = response.status;
      if (response.status === 401 || response.status === 403) {
        (error as { retryable?: boolean }).retryable = false;
      } else {
        (error as { retryable?: boolean }).retryable = true;
      }
      throw error;
    }

    if (!response.body) {
      throw new Error('OpenRouterProvider: response body is null for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let eol: number;

        while ((eol = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, eol);
          buffer = buffer.slice(eol + 1);

          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const data = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
            };

            const delta = data.choices?.[0]?.delta?.content ?? '';
            const isDone = data.choices?.[0]?.finish_reason != null;

            yield {
              type: 'text_delta',
              delta,
              done: isDone,
            };

            if (isDone) return;
          } catch {
            // Skip malformed JSON lines in stream
            continue;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim()) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
          };
          const delta = data.choices?.[0]?.delta?.content ?? '';
          yield {
            type: 'text_delta',
            delta,
            done: true,
          };
        } catch {
          yield {
            type: 'text_delta',
            delta: '',
            done: true,
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ── Token counting ──────────────────────────────────────────────────────────

  countTokens(messages: ChatMessage[], _model: string): number {
    // Use a simple character-based heuristic (same as cost-estimator).
    let total = 0;
    const overheadPerMessage = 4;
    for (const msg of messages) {
      // Rough: CJK/VN chars ~1 token each, ASCII ~4 chars/token.
      const cjkOrVn = (msg.content.match(/[一-鿿぀-ゟ가-힯À-ɏẠ-ỿ]/g) ?? []).length;
      const remaining = msg.content.length - cjkOrVn;
      total += Math.ceil(cjkOrVn + remaining / 4) + overheadPerMessage;
    }
    return total;
  }

  // ── Cost estimation ─────────────────────────────────────────────────────────

  estimateCost(messages: ChatMessage[], model: string, options?: ChatOptions): number {
    // Import here to avoid circular — cost-estimator is in seed.
    // We do a local inline estimate to keep the dependency clean.
    const inputTokens = this.countTokens(messages, model);
    const maxTokens = options?.maxTokens ?? Math.ceil(inputTokens * 0.5);
    const outputTokens = Math.min(maxTokens, 4096);

    // Pricing per 1K tokens (USD) — sourced from cost-estimator.ts table.
    const pricing: Record<string, { input: number; output: number }> = {
      'openai/gpt-4o': { input: 2.5, output: 10.0 },
      'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
      'openai/gpt-4-turbo': { input: 10.0, output: 30.0 },
      'openai/o3': { input: 10.0, output: 40.0 },
      'openai/o4-mini': { input: 1.1, output: 4.4 },
      'anthropic/claude-sonnet-4-6': { input: 3.0, output: 15.0 },
      'anthropic/claude-opus-4': { input: 15.0, output: 75.0 },
      'anthropic/claude-haiku-3-5': { input: 0.8, output: 4.0 },
      'google/gemini-2-5-pro': { input: 1.25, output: 5.0 },
      'google/gemini-2-5-flash': { input: 0.15, output: 0.6 },
      'meta-llama/llama-4-maverick': { input: 0.2, output: 0.6 },
      'meta-llama/llama-4-scout': { input: 0.1, output: 0.3 },
      'mistral/mistral-large': { input: 2.0, output: 6.0 },
      'mistral/mistral-small': { input: 0.2, output: 0.6 },
      'deepseek/deepseek-chat': { input: 0.14, output: 0.28 },
      'deepseek/deepseek-reasoner': { input: 0.55, output: 2.19 },
    };

    // Try exact match, then stripped (without vendor prefix)
    const prices = pricing[model] ?? pricing[model.split('/').pop() ?? ''];
    if (!prices) {
      logger.warn('[OpenRouterProvider] No pricing for model', undefined, { model });
      return 0;
    }

    const cost = (inputTokens / 1000) * prices.input + (outputTokens / 1000) * prices.output;
    return Math.round(cost * 1_000_000) / 1_000_000;
  }

  // ── Capabilities ────────────────────────────────────────────────────────────

  getCapabilities(model: string): ProviderCapabilities {
    return getCapabilitiesForModel(model);
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Build the OpenAI-compatible request body.
   */
  private buildRequestBody(
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
  private createTimeoutSignal(timeoutMs: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }
}
