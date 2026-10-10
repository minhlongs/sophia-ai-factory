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
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  type OpenRouterProviderConfig,
  SERVICE_NAME,
  DEFAULT_MODEL,
  API_URL,
  DEFAULT_TIMEOUT_MS,
} from './types';
import {
  getCapabilitiesForModel,
  buildRequestBody,
  createTimeoutSignal,
} from './request-formatter';
import { handleHttpError } from './error-classifier';
import { countTokens, estimateCost } from './token-estimator';
import { readStreamChunks } from './stream-reader';

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
    if (!shouldAllowRequest(SERVICE_NAME)) {
      throw new Error(`[OpenRouterProvider] Circuit breaker open for ${SERVICE_NAME}`);
    }

    const startTime = performance.now();
    const model = options.model ?? DEFAULT_MODEL;
    const body = buildRequestBody(messages, options, false);

    let response: Response;
    try {
      response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://sophia.agencyos.network',
          ...options.extraHeaders,
        },
        body: JSON.stringify(body),
        signal: createTimeoutSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      const kind = classifyError(error);
      recordFailure(SERVICE_NAME, kind);
      throw error;
    }

    if (!response.ok) {
      await handleHttpError(response, 'OpenRouterProvider.chat');
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

    recordSuccess(SERVICE_NAME);

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

  async *stream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (!shouldAllowRequest(SERVICE_NAME)) {
      throw new Error(`[OpenRouterProvider] Circuit breaker open for ${SERVICE_NAME}`);
    }

    const body = buildRequestBody(messages, options, true);

    let response: Response;
    try {
      response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://sophia.agencyos.network',
          ...options.extraHeaders,
        },
        body: JSON.stringify(body),
        signal: createTimeoutSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      const kind = classifyError(error);
      recordFailure(SERVICE_NAME, kind);
      throw error;
    }

    if (!response.ok) {
      await handleHttpError(response, 'OpenRouterProvider.stream');
    }

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
