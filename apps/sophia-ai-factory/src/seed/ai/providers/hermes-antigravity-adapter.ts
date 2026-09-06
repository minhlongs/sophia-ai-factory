/**
 * @module seed/ai/providers/hermes-antigravity-adapter
 *
 * Hermes Antigravity (local) image generation adapter.
 *
 * Local Stable Diffusion / SDXL server at http://127.0.0.1:8100.
 * Zero construction-time throw on missing keys (Provider contract rule).
 * Circuit breaker + failure classification per seed patterns.
 * BYOK-first: key resolved at call time via ChatOptions.apiKey.
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
import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

const SERVICE_NAME = 'hermes-antigravity';

// ── Request / response contracts ─────────────────────────────────────────────

interface HermesImageRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg_scale?: number;
  seed?: number;
  model?: string;
}

interface HermesImageResponse {
  data: Array<{
    b64_json?: string;
    url?: string;
    media_type?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

// ── Config ───────────────────────────────────────────────────────────────────

export interface HermesAntigravityAdapterConfig {
  apiKey?: string;
  baseUrl?: string;
  label?: string;
}

// ── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Hermes Antigravity local image generation provider adapter.
 *
 * Construction NEVER throws for missing credentials — failures surface
 * at call time when the API key is actually required.
 */
export class HermesAntigravityAdapter implements Provider {
  readonly id: ProviderId = 'hermes';
  readonly label: string;
  readonly apiKey: string | undefined;
  readonly baseUrl: string;

  constructor(config: HermesAntigravityAdapterConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'http://127.0.0.1:8100';
    this.label = config.label ?? 'Hermes Antigravity (Local)';
  }

  // ── chat ───────────────────────────────────────────────────────────────────

  async chat(
    messages: ChatMessage[],
    options: ChatOptions,
  ): Promise<ChatResponse> {
    const apiKey = options.apiKey ?? this.apiKey;
    if (!apiKey) {
      throw new Error(
        'HERMES_MISSING_API_KEY: apiKey is required for Hermes Antigravity',
      );
    }

    if (!shouldAllowRequest(SERVICE_NAME)) {
      throw new Error(
        `[HermesAntigravityAdapter] Circuit breaker open for ${SERVICE_NAME}`,
      );
    }

    const startTime = performance.now();
    const model = (options.model as string) ?? 'hermes-1';

    const prompt = this.extractPrompt(messages);
    if (!prompt) {
      throw new Error('HERMES_EMPTY_PROMPT: prompt is required');
    }

    const { width, height } = this.normalizeAspectRatio(
      options.extraBody?.aspectRatio as string | undefined,
    );

    const body: HermesImageRequest = {
      prompt,
      negative_prompt: options.extraBody?.negativePrompt as
        | string
        | undefined,
      width,
      height,
      steps: (options.extraBody?.steps as number) ?? 30,
      cfg_scale: (options.extraBody?.cfgScale as number) ?? 7,
      seed: options.extraBody?.seed as number | undefined,
      model,
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
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
        logger.warn(
          'Failed to read Hermes error response body',
          undefined,
          { error: String(err), context: SERVICE_NAME },
        );
      }
      const error = new Error(
        `Hermes Antigravity HTTP ${response.status}: ${errorBody.slice(0, 300)}`,
      );
      (error as { status?: number }).status = response.status;
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

    const data = (await response.json()) as HermesImageResponse;

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error(
        'HERMES_EMPTY_RESPONSE: no image data returned from Hermes',
      );
    }

    const latencyMs = Math.round(performance.now() - startTime);

    logger.debug('[HermesAntigravityAdapter] Image generated', undefined, {
      model,
      latencyMs,
      width,
      height,
      steps: body.steps,
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

  // ── stream (wrap chat in single chunk) ─────────────────────────────────────

  async *stream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await this.chat(messages, options);
    yield { type: 'text_delta', delta: response.content, done: true };
  }

  // ── countTokens ────────────────────────────────────────────────────────────

  countTokens(messages: ChatMessage[], _model: string): number {
    const prompt = this.extractPrompt(messages);
    if (!prompt) return 0;
    return Math.ceil(prompt.length / 4) + 4;
  }

  // ── estimateCost (local = free) ────────────────────────────────────────────

  estimateCost(
    _messages: ChatMessage[],
    _model: string,
    _options?: ChatOptions,
  ): number {
    return 0;
  }

  // ── getCapabilities ─────────────────────────────────────────────────────────

  getCapabilities(_model: string): ProviderCapabilities {
    return {
      streaming: false,
      systemRole: false,
      maxOutputTokens: 0,
      maxInputTokens: 4096,
      functionCalling: false,
      vision: false,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private extractPrompt(messages: ChatMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content.trim()) {
        return messages[i].content.trim();
      }
    }
    return '';
  }

  private normalizeAspectRatio(aspectRatio?: string): {
    width: number;
    height: number;
  } {
    switch (aspectRatio) {
      case '16:9':
        return { width: 1344, height: 768 };
      case '9:16':
        return { width: 768, height: 1344 };
      case '1:1':
        return { width: 1024, height: 1024 };
      case '4:3':
        return { width: 1024, height: 768 };
      case '3:4':
        return { width: 768, height: 1024 };
      default:
        return { width: 1024, height: 1024 };
    }
  }

  private createTimeoutSignal(timeoutMs: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }
}
