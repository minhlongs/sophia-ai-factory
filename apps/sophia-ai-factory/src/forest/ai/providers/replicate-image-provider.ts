/**
 * @module forest/ai/providers/replicate-image-provider
 * Replicate Image generation provider using Flux Schnell.
 *
 * Layer: forest — imports seed only.
 */

import {
  type ImageGenerationProvider,
  type ImageGenerationInput,
  type ImageGenerationResult,
  type ProviderCapabilities,
  type HealthStatus,
  ImageGenerationError,
} from '@/seed/ai/multimodal-provider-interface';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';

export class ReplicateImageProvider implements ImageGenerationProvider {
  readonly id = 'replicate';
  readonly label = 'Replicate Image Generation';
  private readonly apiKey: string;
  private readonly keyRef: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; keyRef: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.keyRef = options.keyRef;
    this.baseUrl = (options.baseUrl ?? 'https://api.replicate.com/v1').replace(/\/+$/, '');
  }

  capabilities(): ProviderCapabilities {
    return {
      supportsAspectRatio: true,
      supportsStyle: false,
      maxConcurrency: 5,
    };
  }

  async health(): Promise<HealthStatus> {
    const healthy = shouldAllowRequest('replicate', this.keyRef);
    return { healthy };
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const start = Date.now();
    const requestedAt = Math.floor(Date.now() / 1000);

    if (!input.prompt || !input.prompt.trim()) {
      throw new ImageGenerationError(
        'prompt is required and cannot be empty',
        'VALIDATION_ERROR',
        'replicate',
        false,
      );
    }

    if (!shouldAllowRequest('replicate', this.keyRef)) {
      throw new ImageGenerationError(
        'Circuit breaker open for replicate',
        'CIRCUIT_BREAKER_OPEN',
        'replicate',
        true,
      );
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/models/black-forest-labs/flux-schnell/predictions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Prefer: 'wait=60',
          },
          body: JSON.stringify({
            input: {
              prompt: input.prompt,
              aspect_ratio: input.aspectRatio ?? '1:1',
              num_outputs: 1,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        recordFailure('replicate', classifyHttpStatus(response.status), this.keyRef);
        const isAuth = response.status === 401 || response.status === 403;
        const isRateLimit = response.status === 429;
        const code = isAuth ? 'AUTH_FAILURE' : isRateLimit ? 'RATE_LIMIT' : 'API_ERROR';
        const retryable = response.status >= 500 || response.status === 429;
        throw new ImageGenerationError(
          `Replicate image API failed: ${response.status} - ${errorText}`,
          code,
          'replicate',
          retryable,
        );
      }

      const data = (await response.json()) as { output?: string | string[]; id?: string };
      recordSuccess('replicate', this.keyRef);

      const assetRef = (Array.isArray(data.output) ? data.output[0] : data.output) ?? '';
      const latencyMs = Date.now() - start;

      return {
        assetRef,
        provider: 'replicate',
        latencyMs,
        requestedAt,
        costCents: 1,
        costClassification: 'METERED',
      };
    } catch (err) {
      if (err instanceof ImageGenerationError) throw err;
      const kind = classifyError(err);
      recordFailure('replicate', kind, this.keyRef);
      throw ImageGenerationError.fromUnknown(err, 'replicate');
    }
  }
}
