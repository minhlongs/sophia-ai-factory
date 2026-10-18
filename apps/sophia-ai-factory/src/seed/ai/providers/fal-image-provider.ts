/**
 * @module seed/ai/providers/fal-image-provider
 *
 * Experimental fal.ai image generation provider.
 * POST https://queue.fal.run/{model-id}, auth `Authorization: Key {FAL_KEY}`.
 * Returns CDN URL directly (no base64, no async polling).
 * Layer rule: seed only.
 */

import type {
  ImageGenerationProvider, ImageGenerationInput, ImageGenerationResult,
  ProviderCapabilities, HealthStatus,
} from '../image-generation-provider';
import { ImageGenerationError } from '../image-generation-provider';
import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { logger, type Logger } from '@/seed/utils/logger-utility';
import { executeFalFetch, fetchWithRetry } from './fal-image-fetch';
import { getFalModelPriceCents } from '@/seed/config/fal-pricing';
import { classifyCost } from '@/seed/types/creative-job-economics';
import {
  checkFalEndpointHealth, getFalProviderCapabilities, registerFalProviderCertification,
} from './fal-image-health';
import {
  FAL_PROVIDER_ID, FAL_PROVIDER_LABEL, DEFAULT_FAL_BASE_URL, DEFAULT_FAL_MODEL,
  DEFAULT_FAL_TIMEOUT_MS, FalImageRequestSchema, FalImageResponseSchema,
  ASPECT_RATIO_TO_IMAGE_SIZE, type FalImageRequest, type FalImageProviderConfig,
} from './fal-image-schemas';

export { FalImageRequestSchema, FalImageResponseSchema, type FalImageRequest, type FalImageProviderConfig };

registerFalProviderCertification();

export class FalImageProvider implements ImageGenerationProvider {
  readonly id = FAL_PROVIDER_ID;
  readonly label = FAL_PROVIDER_LABEL;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly keyRef: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly log: Logger;

  constructor(config: FalImageProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_FAL_MODEL;
    this.keyRef = config.keyRef ?? 'platform';
    this.baseUrl = config.baseUrl ?? DEFAULT_FAL_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_FAL_TIMEOUT_MS;
    this.log = config.requestId ? (config.logger ?? logger).withRequestId(config.requestId) : (config.logger ?? logger);
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const start = Date.now();
    const requestedAt = Math.floor(Date.now() / 1000);
    if (!shouldAllowRequest(FAL_PROVIDER_ID, this.keyRef)) {
      throw new ImageGenerationError(`Circuit breaker open for ${FAL_PROVIDER_ID}`, 'CIRCUIT_BREAKER_OPEN', FAL_PROVIDER_ID, true);
    }
    const priceCents = getFalModelPriceCents(this.model);
    const imageSize = input.aspectRatio ? ASPECT_RATIO_TO_IMAGE_SIZE[input.aspectRatio] : undefined;
    const requestBody: FalImageRequest = FalImageRequestSchema.parse({
      prompt: input.prompt, image_size: imageSize, num_inference_steps: 4,
      num_images: 1, enable_safety_checker: true, output_format: 'png',
    });

    const startedAt = Math.floor(Date.now() / 1000);
    try {
      const { result, attempts } = await fetchWithRetry({
        providerId: FAL_PROVIDER_ID, keyRef: this.keyRef, log: this.log,
        attempt: () =>
          executeFalFetch({
            baseUrl: this.baseUrl, model: this.model, apiKey: this.apiKey,
            keyRef: this.keyRef, providerId: FAL_PROVIDER_ID, requestBody,
            responseSchema: FalImageResponseSchema, timeoutMs: this.timeoutMs,
            timeoutOverride: input.timeoutMs,
          }),
      });

      return {
        assetRef: result.imageUrl, provider: FAL_PROVIDER_ID, costCents: priceCents,
        costClassification: classifyCost(priceCents, false), retryCount: attempts,
        requestedAt, startedAt, latencyMs: Date.now() - start,
        metadata: {
          model: this.model, seed: result.seed, timings: result.timings,
          width: result.width, height: result.height, contentType: result.contentType, attempts,
        },
      };
    } catch (err) {
      const wrapped = ImageGenerationError.fromUnknown(err, FAL_PROVIDER_ID);
      if (err instanceof ImageGenerationError) wrapped.retryCount = err.retryCount;
      throw wrapped;
    }
  }

  capabilities(): ProviderCapabilities {
    return getFalProviderCapabilities();
  }

  async health(): Promise<HealthStatus> {
    return checkFalEndpointHealth(this.baseUrl);
  }
}
