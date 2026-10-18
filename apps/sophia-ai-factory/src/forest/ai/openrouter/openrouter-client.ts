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
  type OpenRouterProviderConfig,
  API_URL,
} from './types';
import { getCapabilitiesForModel } from './request-formatter';
import { countTokens, estimateCost } from './token-estimator';
import { readStreamChunks } from './stream-reader';
import {
  executeOpenRouterRequest,
  parseOpenRouterChatResponse,
} from './openrouter-http';

export { executeOpenRouterRequest, parseOpenRouterChatResponse };

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

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const startTime = performance.now();
    const response = await executeOpenRouterRequest(
      this.baseUrl,
      this.apiKey,
      messages,
      options,
      false,
      'OpenRouterProvider.chat',
    );
    return parseOpenRouterChatResponse(response, this.id, options, startTime);
  }

  async *stream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await executeOpenRouterRequest(
      this.baseUrl,
      this.apiKey,
      messages,
      options,
      true,
      'OpenRouterProvider.stream',
    );

    if (!response.body) {
      throw new Error('OpenRouterProvider: response body is null for streaming');
    }

    yield* readStreamChunks(response.body);
  }

  countTokens(messages: ChatMessage[], _model: string): number {
    return countTokens(messages);
  }

  estimateCost(messages: ChatMessage[], model: string, options?: ChatOptions): number {
    const cost = estimateCost(messages, model, options);
    if (cost === 0) {
      logger.warn('[OpenRouterProvider] No pricing for model', undefined, { model });
    }
    return cost;
  }

  getCapabilities(model: string): ProviderCapabilities {
    return getCapabilitiesForModel(model);
  }
}
