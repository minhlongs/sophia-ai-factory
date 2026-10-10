/**
 * @module forest/ai/anthropic/anthropic-provider
 * Primary Anthropic Provider implementation.
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
import {
  API_URL,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TIMEOUT_MS,
  type AnthropicProviderConfig,
} from './types';
import {
  getCapabilitiesForModel,
  buildHeaders,
  normaliseMessages,
  createTimeoutSignal,
  classifyAnthropicError,
} from './client-factory';
import { streamAnthropicMessages } from './message-streamer';
import { countAnthropicTokens, estimateAnthropicCost } from './token-counter';

/**
 * Anthropic provider adapter.
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

    const { system, apiMessages } = normaliseMessages(messages);

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
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify(body),
      signal: createTimeoutSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (err) {
        logger.warn('Failed to read Anthropic error response body', undefined, {
          error: String(err),
          context: 'AnthropicProvider.chat',
        });
      }
      throw classifyAnthropicError(response.status, errorBody);
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
    const { system, apiMessages } = normaliseMessages(messages);

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
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify(body),
      signal: createTimeoutSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (err) {
        logger.warn('Failed to read Anthropic stream error response body', undefined, {
          error: String(err),
          context: 'AnthropicProvider.stream',
        });
      }
      throw classifyAnthropicError(response.status, errorBody);
    }

    if (!response.body) {
      throw new Error('AnthropicProvider: response body is null for streaming');
    }

    const reader = response.body.getReader();
    yield* streamAnthropicMessages(reader);
  }

  // ── Token counting ──────────────────────────────────────────────────────────

  countTokens(messages: ChatMessage[], model: string): number {
    return countAnthropicTokens(messages, model);
  }

  // ── Cost estimation ─────────────────────────────────────────────────────────

  estimateCost(messages: ChatMessage[], model: string, options?: ChatOptions): number {
    return estimateAnthropicCost(messages, model, options);
  }

  // ── Capabilities ────────────────────────────────────────────────────────────

  getCapabilities(model: string): ProviderCapabilities {
    return getCapabilitiesForModel(model);
  }
}
