import type {
  ProviderId,
  ChatMessage,
  ChatOptions,
  ChatResponse,
} from '@/seed/ai/provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  SERVICE_NAME,
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
} from './types';
import {
  buildRequestBody,
  createTimeoutSignal,
} from './request-formatter';
import { handleHttpError } from './error-classifier';

export interface OpenRouterJsonPayload {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
}

export async function executeOpenRouterRequest(
  baseUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  options: ChatOptions,
  stream: boolean,
  operation: string,
): Promise<Response> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[OpenRouterProvider] Circuit breaker open for ${SERVICE_NAME}`);
  }

  const body = buildRequestBody(messages, options, stream);

  let response: Response;
  try {
    response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
    await handleHttpError(response, operation);
  }

  return response;
}

export async function parseOpenRouterChatResponse(
  response: Response,
  providerId: ProviderId,
  options: ChatOptions,
  startTime: number,
): Promise<ChatResponse> {
  const model = options.model ?? DEFAULT_MODEL;
  const data = (await response.json()) as OpenRouterJsonPayload;

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
    provider: providerId,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
    stopReason: data.choices?.[0]?.finish_reason ?? 'unknown',
    latencyMs,
  };
}
