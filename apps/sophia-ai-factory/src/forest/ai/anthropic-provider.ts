/**
 * @module forest/ai/anthropic-provider
 *
 * Anthropic provider adapter implementing the seed ProviderInterface.
 *
 * Wraps the existing anthropic-adapter.ts logic (callAnthropicFull,
 * SSE streaming) into the Provider interface contract.
 * Handles chat + streaming with proper SSE parsing via anthropic-sse-parser.
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
import { parseAnthropicSse } from '@/forest/ai/anthropic-sse-parser';
import { logger } from '@/seed/utils/logger-utility';

// ── Constants ──────────────────────────────────────────────────────────────────

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 120_000;

// ── Capabilities table ─────────────────────────────────────────────────────────

/**
 * Static capabilities per Anthropic model family.
 */
function getCapabilitiesForModel(model: string): ProviderCapabilities {
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

// ── Provider implementation ────────────────────────────────────────────────────

export interface AnthropicProviderConfig {
  apiKey: string;
  label?: string;
}

/**
 * Anthropic provider adapter.
 *
 * Implements the Provider interface using the Anthropic Messages API
 * directly. Handles chat + streaming with proper SSE event parsing.
 */
export class AnthropicProvider implements Provider {
  readonly id: ProviderId = 'anthropic';
  readonly label: string;
  readonly apiKey: string;

  constructor(config: AnthropicProviderConfig) {
    this.apiKey = config.apiKey;
    this.label = config.label ?? 'Anthropic';
  }

  // ── Chat (full response) ────────────────────────────────────────────────────

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const startTime = performance.now();
    const model = options.model ?? DEFAULT_MODEL;

    const { system, apiMessages } = this.normaliseMessages(messages);

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: apiMessages,
    };
    if (system) body.system = system;
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.stop && options.stop.length > 0) body.stop_sequences = options.stop;
    if (options.seed !== undefined) body.seed = options.seed;
    if (options.responseFormat) body.response_format = options.responseFormat;
    if (options.extraBody) Object.assign(body, options.extraBody);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal: this.createTimeoutSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (err) {
        logger.warn('Failed to read Anthropic error response body', undefined, { error: String(err), context: 'AnthropicProvider.chat' });
      }
      const error = new Error(`Anthropic HTTP ${response.status}: ${errorBody.slice(0, 300)}`);
      (error as { status?: number; retryable?: boolean }).status = response.status;

      // Classify error retryability
      if (response.status === 401 || response.status === 403) {
        // Auth failure — non-retryable, key is invalid
        (error as { retryable?: boolean }).retryable = false;
        (error as { code?: string }).code = 'INVALID_KEY';
      } else if (response.status === 429 || response.status === 402) {
        // Rate limit / quota — retryable with backoff
        (error as { retryable?: boolean }).retryable = true;
        (error as { code?: string }).code = 'RATE_LIMITED';
      } else if (response.status >= 500) {
        // Server error — retryable
        (error as { retryable?: boolean }).retryable = true;
        (error as { code?: string }).code = 'SERVER_ERROR';
      } else {
        // Other 4xx — non-retryable
        (error as { retryable?: boolean }).retryable = false;
      }

      logger.warn('[AnthropicProvider] Chat request failed', undefined, {
        status: response.status,
        retryable: (error as { retryable?: boolean }).retryable,
        code: (error as { code?: string }).code,
      });

      throw error;
    }

    const data = (await response.json()) as {
      id: string;
      content: Array<{ type: string; text?: string }>;
      model: string;
      stop_reason: string | null;
      usage: { input_tokens: number; output_tokens: number };
    };

    const textContent = data.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const latencyMs = Math.round(performance.now() - startTime);

    logger.debug('[AnthropicProvider] Chat completed', undefined, {
      model,
      latencyMs,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      stopReason: data.stop_reason,
    });

    return {
      content: textContent,
      model: data.model,
      provider: this.id,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
      stopReason: data.stop_reason ?? 'unknown',
      latencyMs,
    };
  }

  // ── Streaming ───────────────────────────────────────────────────────────────

  async *stream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const model = options.model ?? DEFAULT_MODEL;
    const { system, apiMessages } = this.normaliseMessages(messages);

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: apiMessages,
      stream: true,
    };
    if (system) body.system = system;
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.stop && options.stop.length > 0) body.stop_sequences = options.stop;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal: this.createTimeoutSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (err) {
        logger.warn('Failed to read Anthropic stream error response body', undefined, { error: String(err), context: 'AnthropicProvider.stream' });
      }
      const error = new Error(`Anthropic HTTP ${response.status}: ${errorBody.slice(0, 300)}`);
      (error as { status?: number; retryable?: boolean }).status = response.status;

      if (response.status === 401 || response.status === 403) {
        (error as { retryable?: boolean }).retryable = false;
        (error as { code?: string }).code = 'INVALID_KEY';
      } else if (response.status === 429 || response.status === 402) {
        (error as { retryable?: boolean }).retryable = true;
        (error as { code?: string }).code = 'RATE_LIMITED';
      } else if (response.status >= 500) {
        (error as { retryable?: boolean }).retryable = true;
        (error as { code?: string }).code = 'SERVER_ERROR';
      } else {
        (error as { retryable?: boolean }).retryable = false;
      }

      throw error;
    }

    if (!response.body) {
      throw new Error('AnthropicProvider: response body is null for streaming');
    }

    const reader = response.body.getReader();
    let accumulatedText = '';

    try {
      for await (const event of parseAnthropicSse(reader)) {
        switch (event.type) {
          case 'text_delta':
            accumulatedText += event.text;
            yield {
              type: 'text_delta',
              delta: event.text,
              done: false,
            };
            break;

          case 'message_stop':
            yield {
              type: 'text_delta',
              delta: '',
              done: true,
            };
            return;

          case 'parse_error':
            logger.warn('[AnthropicProvider] SSE parse error', undefined, {
              reason: event.reason,
              rawPayload: event.rawPayload,
            });
            break;

          default:
            // Other events (message_start, content_block_start, etc.)
            // are handled silently — only text deltas are surfaced.
            break;
        }
      }

      // Stream ended without explicit message_stop — emit final chunk
      yield {
        type: 'text_delta',
        delta: '',
        done: true,
      };
    } finally {
      reader.releaseLock();
    }
  }

  // ── Token counting ──────────────────────────────────────────────────────────

  countTokens(messages: ChatMessage[], _model: string): number {
    let total = 0;
    const overheadPerMessage = 4;
    for (const msg of messages) {
      const cjkOrVn = (msg.content.match(/[一-鿿぀-ゟ가-힯À-ɏẠ-ỿ]/g) ?? []).length;
      const remaining = msg.content.length - cjkOrVn;
      total += Math.ceil(cjkOrVn + remaining / 4) + overheadPerMessage;
    }
    return total;
  }

  // ── Cost estimation ─────────────────────────────────────────────────────────

  estimateCost(messages: ChatMessage[], model: string, options?: ChatOptions): number {
    const inputTokens = this.countTokens(messages, model);
    const maxTokens = options?.maxTokens ?? Math.ceil(inputTokens * 0.5);
    const outputTokens = Math.min(maxTokens, 4096);

    // Pricing per 1K tokens (USD)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
      'claude-opus-4': { input: 15.0, output: 75.0 },
      'claude-haiku-3-5': { input: 0.8, output: 4.0 },
      'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
      'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
    };

    const prices = pricing[model];
    if (!prices) {
      logger.warn('[AnthropicProvider] No pricing for model', undefined, { model });
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
   * Build the Anthropic Messages API headers.
   */
  private buildHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    };
  }

  /**
   * Normalise provider-agnostic ChatMessage[] into Anthropic format.
   *
   * Separates system messages from the conversation array
   * (Anthropic requires system as a top-level field).
   */
  private normaliseMessages(
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
  private createTimeoutSignal(timeoutMs: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }
}
