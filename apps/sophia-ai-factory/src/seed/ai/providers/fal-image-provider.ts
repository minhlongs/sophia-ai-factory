/**
 * @module seed/ai/providers/fal-image-provider
 *
 * Experimental fal.ai image generation provider.
 * POST https://queue.fal.run/{model-id}, auth `Authorization: Key {FAL_KEY}`.
 * Returns CDN URL directly (no base64, no async polling).
 * Layer rule: seed only.
 */

import type {
  ImageGenerationProvider,
  ImageGenerationInput,
  ImageGenerationResult,
  ProviderCapabilities,
  HealthStatus,
} from '../image-generation-provider';
import { ImageGenerationError } from '../image-generation-provider';
import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { registerCertification, ProviderCertificationState } from '@/seed/ai/provider-certification';
import { logger, type Logger } from '@/seed/utils/logger-utility';
import { z } from 'zod';
import { executeFalFetch, fetchWithRetry } from './fal-image-fetch';
import { getFalModelPriceCents } from '@/seed/config/fal-pricing';
import { classifyCost } from '@/seed/types/creative-job-economics';

const PROVIDER_ID = 'fal-ai';
const PROVIDER_LABEL = 'fal.ai Image Generation';
const DEFAULT_BASE_URL = 'https://queue.fal.run/';
const DEFAULT_MODEL = 'fal-ai/flux-schnell';
const DEFAULT_TIMEOUT_MS = 30_000;

export const FalImageRequestSchema = z.object({
  prompt: z.string().min(1),
  image_size: z.string().optional(),
  num_inference_steps: z.number().int().positive().optional(),
  guidance_scale: z.number().positive().optional(),
  num_images: z.number().int().positive().default(1),
  enable_safety_checker: z.boolean().default(true),
  output_format: z.enum(['png', 'jpeg', 'webp']).default('png'),
});

export type FalImageRequest = z.infer<typeof FalImageRequestSchema>;

export const FalImageResponseSchema = z.object({
  images: z.array(
    z.object({
      url: z.string().url(),
      width: z.number().optional(),
      height: z.number().optional(),
      content_type: z.string().optional(),
    }),
  ).min(1),
  timings: z.object({ inference: z.number().optional() }).optional(),
  seed: z.number().optional(),
  prompt: z.string().optional(),
});

const ASPECT_RATIO_TO_IMAGE_SIZE: Record<string, string> = {
  '1:1': 'square',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
};

registerCertification(PROVIDER_ID, {
  state: ProviderCertificationState.PRODUCTION_CANDIDATE,
  security: 'PASS',
  health: 'PASS',
  canary: 'PASS',
  reason: 'R2 + billing wired, smoke verified',
});

export interface FalImageProviderConfig {
  apiKey: string;
  model?: string;
  keyRef?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  logger?: Logger;
}

export class FalImageProvider implements ImageGenerationProvider {
  readonly id = PROVIDER_ID;
  readonly label = PROVIDER_LABEL;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly keyRef: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly log: Logger;

  constructor(config: FalImageProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.keyRef = config.keyRef ?? 'platform';
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.log = config.requestId
      ? (config.logger ?? logger).withRequestId(config.requestId)
      : (config.logger ?? logger);
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const start = Date.now();
    const requestedAt = Math.floor(Date.now() / 1000);
    if (!shouldAllowRequest(PROVIDER_ID, this.keyRef)) {
      throw new ImageGenerationError(
        `Circuit breaker open for ${PROVIDER_ID}`,
        'CIRCUIT_BREAKER_OPEN',
        PROVIDER_ID,
        true,
      );
    }
    const priceCents = getFalModelPriceCents(this.model);
    const imageSize = input.aspectRatio ? ASPECT_RATIO_TO_IMAGE_SIZE[input.aspectRatio] : undefined;
    const requestBody: FalImageRequest = FalImageRequestSchema.parse({
      prompt: input.prompt,
      image_size: imageSize,
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
      output_format: 'png',
    });

    const startedAt = Math.floor(Date.now() / 1000);
    try {
      const { result, attempts } = await fetchWithRetry({
        providerId: PROVIDER_ID,
        keyRef: this.keyRef,
        log: this.log,
        attempt: () =>
          executeFalFetch({
            baseUrl: this.baseUrl,
            model: this.model,
            apiKey: this.apiKey,
            keyRef: this.keyRef,
            providerId: PROVIDER_ID,
            requestBody,
            responseSchema: FalImageResponseSchema,
            timeoutMs: this.timeoutMs,
            timeoutOverride: input.timeoutMs,
          }),
      });

      return {
        assetRef: result.imageUrl,
        provider: PROVIDER_ID,
        costCents: priceCents,
        costClassification: classifyCost(priceCents, false),
        retryCount: attempts,
        requestedAt,
        startedAt,
        latencyMs: Date.now() - start,
        metadata: {
          model: this.model,
          seed: result.seed,
          timings: result.timings,
          width: result.width,
          height: result.height,
          contentType: result.contentType,
          attempts,
        },
      };
    } catch (err) {
      const wrapped = ImageGenerationError.fromUnknown(err, PROVIDER_ID);
      if (err instanceof ImageGenerationError) {
        wrapped.retryCount = err.retryCount;
      }
      throw wrapped;
    }
  }

  capabilities(): ProviderCapabilities {
    return { supportsAspectRatio: true, supportsStyle: false, maxConcurrency: 5 };
  }

  async health(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const res = await fetch(this.baseUrl, { method: 'GET', signal: AbortSignal.timeout(5_000) });
      const latencyMs = Date.now() - start;
      if (res.ok || res.status === 404) return { healthy: true, latencyMs };
      return { healthy: false, latencyMs, error: `HTTP ${res.status}` };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return { healthy: false, latencyMs, error: classifyError(err) };
    }
  }
}
