/**
 * @module seed/ai/providers/openrouter-image-adapter
 *
 * OpenRouter Image Generation adapter.
 *
 * Implements the creative-economy image generation primitive used by
 * the AB experiment engine (thumbnail A/B) via CreativeProvider.generateThumbnail.
 *
 * Contract:
 * - Zero construction-time throw on missing keys (Provider contract rule).
 * - Real HTTP call to OpenRouter /images endpoint.
 * - Circuit breaker + failure classification per seed patterns.
 * - BYOK-first: key resolved at call time via ChatOptions.apiKey.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type {
  Provider,
  ProviderId,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
} from '../provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

const SERVICE_NAME = 'openrouter-image';

const API_URL = 'https://openrouter.ai/api/v1/images';

const DEFAULT_MODEL = 'openai/dall-e-3';

/**
 * Models with known pricing entries in {@link OpenRouterImageAdapter.estimateCost}.
 * Other OpenRouter image models work too — they fall back to a default price.
 */
export const OPENROUTER_IMAGE_MODELS = [
  'openai/dall-e-3',
  'openai/dall-e-2',
  'stability/stable-diffusion-xl',
  'google/imagen-3',
] as const;

function getCapabilitiesForModel(_model: string): ProviderCapabilities {
  return {
    streaming: false,
    systemRole: false,
    maxOutputTokens: 0,
    maxInputTokens: 4096,
    functionCalling: false,
    vision: false,
  };
}

interface OpenRouterImageRequest {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  response_format?: 'url' | 'b64_json';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

interface OpenRouterImageResponse {
  created: number;
  data: Array<{
    b64_json?: string;
    url?: string;
    media_type?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
}

export interface OpenRouterImageAdapterConfig {
  apiKey?: string;
  baseUrl?: string;
  label?: string;
}

/**
 * OpenRouter Image Generation provider adapter.
 *
 * Implements the Provider interface for image generation via
 * OpenRouter's /images endpoint. Does NOT implement CreativeProvider
 * methods directly; the CreativeProvider layer wraps this for
 * generateThumbnail, generateStoryboard, etc.
 *
 * Construction NEVER throws for missing credentials — failures surface
 * at call time when the API key is actually required.
 */
export class OpenRouterImageAdapter implements Provider {
  readonly id: ProviderId = 'openrouter';
  readonly label: string;
  readonly apiKey: string | undefined;
  readonly baseUrl: string;

  constructor(config: OpenRouterImageAdapterConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? API_URL;
    this.label = config.label ?? 'OpenRouter Image Generation';
  }

  /**
   * Generate an image from a prompt.
   *
   * Returns a ChatResponse with the base64-encoded image in `content`
   * (formatted as a data URI for convenience) and usage metadata.
   *
   * @throws {Error} — 401/403 → ProviderInvalidKeyError; 429/402 → ProviderQuotaExceededError; 5xx/timeout → ProviderNetworkError
   */
  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const apiKey = options.apiKey ?? this.apiKey;
    if (!apiKey) {
      throw new Error('OPENROUTER_IMAGE_MISSING_API_KEY: apiKey is required');
    }

    if (!shouldAllowRequest(SERVICE_NAME)) {
      throw new Error(`[OpenRouterImageAdapter] Circuit breaker open for ${SERVICE_NAME}`);
    }

    const startTime = performance.now();
    const model = options.model ?? DEFAULT_MODEL;

    const prompt = this.extractPrompt(messages);
    if (!prompt) {
      throw new Error('OPENROUTER_IMAGE_EMPTY_PROMPT: prompt is required');
    }

    const body: OpenRouterImageRequest = {
      model,
      prompt,
      n: 1,
      size: this.normalizeSize(options.extraBody?.size as string | undefined),
      response_format: 'b64_json',
      quality: (options.extraBody?.quality as 'standard' | 'hd') ?? 'standard',
      style: (options.extraBody?.style as 'vivid' | 'natural') ?? 'vivid',
    };

    let response: Response;
    try {
      response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://sophia.agencyos.network',
          ...options.extraHeaders,
        },
        body: JSON.stringify(body),
        signal: this.createTimeoutSignal(options.timeoutMs ?? 120_000),
      });
    } catch (error) {
      const kind = classifyError(error);
      recordFailure(SERVICE_NAME, kind);
      throw error;
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (err) {
        logger.warn('Failed to read OpenRouter Image error response body', undefined, {
          error: String(err),
          context: 'OpenRouterImageAdapter.chat',
        });
      }
      const error = new Error(`OpenRouter Image HTTP ${response.status}: ${errorBody.slice(0, 300)}`);
      (error as { status?: number; retryable?: boolean }).status = response.status;
      if (response.status === 401 || response.status === 403) {
        (error as { retryable?: boolean }).retryable = false;
      } else if (response.status === 429 || response.status >= 500) {
        (error as { retryable?: boolean }).retryable = true;
      } else {
        (error as { retryable?: boolean }).retryable = false;
      }
      const kind = classifyError(error);
      recordFailure(SERVICE_NAME, kind);
      throw error;
    }

    const data = (await response.json()) as OpenRouterImageResponse;

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('OPENROUTER_IMAGE_EMPTY_RESPONSE: no image data returned');
    }

    const latencyMs = Math.round(performance.now() - startTime);

    logger.debug('[OpenRouterImageAdapter] Image generated', undefined, {
      model,
      latencyMs,
      size: body.size,
      quality: body.quality,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    });

    recordSuccess(SERVICE_NAME);

    return {
      content: `data:image/png;base64,${b64}`,
      model,
      provider: this.id,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      stopReason: 'end_turn',
      latencyMs,
      raw: data as unknown as Record<string, unknown>,
    };
  }

  /**
   * Streaming not supported for image generation — yields single completion chunk.
   */
  async *stream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await this.chat(messages, options);
    yield {
      type: 'text_delta',
      delta: response.content,
      done: true,
    };
  }

  /**
   * Estimate token count for a prompt (character-based heuristic).
   */
  countTokens(messages: ChatMessage[], _model: string): number {
    const prompt = this.extractPrompt(messages);
    if (!prompt) return 0;
    // Rough heuristic: ~4 chars/token for English prompts
    return Math.ceil(prompt.length / 4) + 4;
  }

  /**
   * Estimate USD cost for an image generation request.
   *
   * Pricing per image (USD) — approximate, varies by model/quality.
   * DALL-E 3 HD 1024x1024 ≈ $0.08; SDXL ≈ $0.04
   */
  estimateCost(messages: ChatMessage[], model: string, options?: ChatOptions): number {
    const quality = (options?.extraBody?.quality as string) ?? 'standard';
    const size = this.normalizeSize(options?.extraBody?.size as string | undefined);

    const pricing: Record<string, Record<string, number>> = {
      'openai/dall-e-3': {
        '1024x1024': quality === 'hd' ? 0.08 : 0.04,
        '1024x1792': quality === 'hd' ? 0.12 : 0.08,
        '1792x1024': quality === 'hd' ? 0.12 : 0.08,
      },
      'openai/dall-e-2': {
        '256x256': 0.016,
        '512x512': 0.018,
        '1024x1024': 0.02,
      },
      'stability/stable-diffusion-xl': {
        '1024x1024': 0.04,
      },
      'google/imagen-3': {
        '1024x1024': 0.06,
      },
    };

    const modelPricing = pricing[model] ?? pricing[model.split('/').pop() ?? ''];
    return modelPricing?.[size] ?? 0.04;
  }

  /**
   * Return static capabilities for the given model.
   */
  getCapabilities(model: string): ProviderCapabilities {
    return getCapabilitiesForModel(model);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────────

  /**
   * Extract the prompt from messages (last user message content).
   */
  private extractPrompt(messages: ChatMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content.trim()) {
        return messages[i].content.trim();
      }
    }
    return '';
  }

  /**
   * Normalize size string to supported format.
   */
  private normalizeSize(size?: string): string {
    if (!size) return '1024x1024';
    const normalized = size.toLowerCase().replace(/\s/g, '');
    const validSizes = ['1024x1024', '1024x1792', '1792x1024', '256x256', '512x512'];
    return validSizes.includes(normalized) ? normalized : '1024x1024';
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