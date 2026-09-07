/**
 * @module seed/ai/providers/openrouter-image-generation-adapter
 *
 * OpenRouter Image Generation adapter — implements the ImageGenerationProvider
 * interface (distinct from the text-oriented Provider interface).
 *
 * Wraps OpenRouterImageAdapter to translate ImageGenerationInput → ChatMessage
 * and ChatResponse → ImageGenerationResult, so the creative image pipeline
 * can use OpenRouter as a real image provider.
 *
 * Contract:
 * - Zero construction-time throw on missing keys (Provider contract rule).
 * - Real HTTP call to OpenRouter /images endpoint (delegated to OpenRouterImageAdapter).
 * - Circuit breaker + failure classification per seed patterns.
 * - BYOK-first: key resolved at call time via ImageGenerationInput (caller passes it).
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ImageGenerationInput, ImageGenerationResult, ImageGenerationProvider, ProviderCapabilities, HealthStatus } from '../image-generation-provider';
import { ImageGenerationError } from '../image-generation-provider';
import { OpenRouterImageAdapter, type OpenRouterImageAdapterConfig } from './openrouter-image-adapter';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

const SERVICE_NAME = 'openrouter-image-generation';

const ASPECT_TO_SIZE: Record<string, string> = {
  '1:1': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '4:3': '1024x768',
};

export interface OpenRouterImageGenerationAdapterConfig extends OpenRouterImageAdapterConfig {
  model?: string;
}

/**
 * OpenRouter Image Generation provider adapter.
 *
 * Implements the ImageGenerationProvider interface for use by the creative
 * image pipeline (Inngest jobs, thumbnail A/B, etc.).
 *
 * Construction NEVER throws for missing credentials — failures surface
 * at call time when the API key is actually required.
 */
export class OpenRouterImageGenerationAdapter implements ImageGenerationProvider {
  readonly id = 'openrouter-image';
  readonly label: string;
  private readonly inner: OpenRouterImageAdapter;
  private readonly defaultModel: string;

  constructor(config: OpenRouterImageGenerationAdapterConfig = {}) {
    this.inner = new OpenRouterImageAdapter({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      label: config.label,
    });
    this.label = config.label ?? 'OpenRouter Image Generation';
    this.defaultModel = config.model ?? 'openai/dall-e-3';
  }

  /**
   * Generate an image from the given input.
   *
   * Translates ImageGenerationInput → ChatMessage and delegates to
   * OpenRouterImageAdapter.chat(), then maps the response back to
   * ImageGenerationResult.
   *
   * @throws {ImageGenerationError} — with code indicating failure kind.
   */
  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    if (!input.prompt?.trim()) {
      throw new ImageGenerationError(
        'OPENROUTER_IMAGE_EMPTY_PROMPT: prompt is required',
        'EMPTY_PROMPT',
        this.id,
        false,
      );
    }

    const startTime = performance.now();

    if (!shouldAllowRequest(SERVICE_NAME)) {
      throw new ImageGenerationError(
        `[OpenRouterImageGenerationAdapter] Circuit breaker open for ${SERVICE_NAME}`,
        'CIRCUIT_OPEN',
        this.id,
        true,
      );
    }

    const size = ASPECT_TO_SIZE[input.aspectRatio ?? '1:1'] ?? '1024x1024';

    const messages = [
      { role: 'user' as const, content: input.prompt },
    ];

    const apiKey = this.inner.apiKey;
    if (!apiKey) {
      throw new ImageGenerationError(
        'OPENROUTER_IMAGE_MISSING_API_KEY: apiKey is required for image generation',
        'MISSING_API_KEY',
        this.id,
        false,
      );
    }

    const options = {
      apiKey,
      model: this.defaultModel,
      timeoutMs: input.timeoutMs ?? 120_000,
      extraBody: {
        size,
        quality: 'standard' as const,
        style: (input.style as 'vivid' | 'natural' | undefined) ?? 'vivid',
      },
    };

    let response;
    try {
      response = await this.inner.chat(messages, options);
    } catch (error) {
      const kind = classifyError(error);
      recordFailure(SERVICE_NAME, kind);
      const message = error instanceof Error ? error.message : String(error);
      const retryable = this.isRetryable(message);
      throw new ImageGenerationError(message, this.classifyErrorCode(message), this.id, retryable);
    }

    recordSuccess(SERVICE_NAME);

    const latencyMs = Math.round(performance.now() - startTime);

    logger.debug('[OpenRouterImageGenerationAdapter] Image generated', undefined, {
      latencyMs,
      size,
      model: this.defaultModel,
    });

    return {
      assetRef: response.content,
      provider: this.id,
      costCents: 0,
      latencyMs,
      metadata: {
        model: response.model,
        raw: response.raw,
      },
    };
  }

  /**
   * Return static capability profile for this provider.
   */
  capabilities(): ProviderCapabilities {
    return {
      supportsAspectRatio: true,
      supportsStyle: true,
      maxConcurrency: 5,
    };
  }

  /**
   * Check provider health.
   *
   * OpenRouter is considered healthy when the circuit breaker allows requests.
   * No separate health endpoint is called — the circuit breaker is the source
   * of truth for availability.
   */
  async health(): Promise<HealthStatus> {
    const healthy = shouldAllowRequest(SERVICE_NAME);
    return {
      healthy,
      latencyMs: healthy ? undefined : undefined,
      error: healthy ? undefined : 'Circuit breaker open',
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private isRetryable(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('429') || lower.includes('500') || lower.includes('503') || lower.includes('timeout');
  }

  private classifyErrorCode(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('401') || lower.includes('403')) return 'AUTH_FAILURE';
    if (lower.includes('429')) return 'RATE_LIMIT';
    if (lower.includes('402') || lower.includes('quota')) return 'QUOTA_EXCEEDED';
    if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('504')) return 'SERVER_ERROR';
    if (lower.includes('timeout')) return 'TIMEOUT';
    if (lower.includes('circuit breaker open')) return 'CIRCUIT_OPEN';
    return 'UNKNOWN_ERROR';
  }
}
