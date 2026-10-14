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
import { type AnthropicProviderConfig } from './types';
import { getCapabilitiesForModel } from './client-factory';
import { streamAnthropicMessages } from './message-streamer';
import { countAnthropicTokens, estimateAnthropicCost } from './token-counter';
import {
  buildAnthropicRequestBody,
  postAnthropicMessagesRequest,
} from './anthropic-request-helpers';

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

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const startTime = performance.now();
    const { model, body } = buildAnthropicRequestBody(messages, options, false);

    const response = await postAnthropicMessagesRequest(
      this.apiKey,
      body,
      options.timeoutMs,
      'AnthropicProvider.chat',
    );

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

  async *stream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const { body } = buildAnthropicRequestBody(messages, options, true);

    const response = await postAnthropicMessagesRequest(
      this.apiKey,
      body,
      options.timeoutMs,
      'AnthropicProvider.stream',
    );

    if (!response.body) {
      throw new Error('AnthropicProvider: response body is null for streaming');
    }

    const reader = response.body.getReader();
    yield* streamAnthropicMessages(reader);
  }

  countTokens(messages: ChatMessage[], model: string): number {
    return countAnthropicTokens(messages, model);
  }

  estimateCost(messages: ChatMessage[], model: string, options?: ChatOptions): number {
    return estimateAnthropicCost(messages, model, options);
  }

  getCapabilities(model: string): ProviderCapabilities {
    return getCapabilitiesForModel(model);
  }
}
