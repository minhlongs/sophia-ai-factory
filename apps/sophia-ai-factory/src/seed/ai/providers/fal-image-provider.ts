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
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError, FailureKind } from '@/seed/types/failure-kind';
import { registerCertification, ProviderCertificationState } from '@/seed/ai/provider-certification';
import { z } from 'zod';

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

const FalImageResponseSchema = z.object({
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
  state: ProviderCertificationState.EXPERIMENTAL,
  security: 'NOT_EVALUATED',
  health: 'NOT_EVALUATED',
  canary: 'NOT_EVALUATED',
  reason: 'Experimental adapter — not production ready',
});

export interface FalImageProviderConfig {
  apiKey: string;
  model?: string;
  keyRef?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class FalImageProvider implements ImageGenerationProvider {
  readonly id = PROVIDER_ID;
  readonly label = PROVIDER_LABEL;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly keyRef: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: FalImageProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.keyRef = config.keyRef ?? 'platform';
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const start = Date.now();
    if (!shouldAllowRequest(PROVIDER_ID, this.keyRef)) {
      throw new ImageGenerationError(
        `Circuit breaker open for ${PROVIDER_ID}`,
        'CIRCUIT_BREAKER_OPEN',
        PROVIDER_ID,
        true,
      );
    }
    const imageSize = input.aspectRatio ? ASPECT_RATIO_TO_IMAGE_SIZE[input.aspectRatio] : undefined;
    const requestBody: FalImageRequest = FalImageRequestSchema.parse({
      prompt: input.prompt,
      image_size: imageSize,
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
      output_format: 'png',
    });
    try {
      const res = await fetch(`${this.baseUrl}${this.model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Key ${this.apiKey}` },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(input.timeoutMs ?? this.timeoutMs),
      });
      if (!res.ok) {
        const kind = classifyHttpStatus(res.status);
        recordFailure(PROVIDER_ID, kind, this.keyRef);
        const errBody = await res.text().catch(() => '');
        const snippet = errBody.length > 200 ? `${errBody.slice(0, 200)}…` : errBody;
        throw new ImageGenerationError(
          `${PROVIDER_ID} ${res.status}${snippet ? ` ${snippet}` : ''}`,
          kind,
          PROVIDER_ID,
          kind === FailureKind.RATE_LIMIT || kind === FailureKind.SERVER_ERROR || kind === FailureKind.TIMEOUT,
        );
      }
      const raw = (await res.json()) as unknown;
      const parsed = FalImageResponseSchema.safeParse(raw);
      if (!parsed.success) {
        recordFailure(PROVIDER_ID, FailureKind.UNKNOWN, this.keyRef);
        throw new ImageGenerationError(
          `${PROVIDER_ID} response validation failed: ${parsed.error.message}`,
          'INVALID_RESPONSE',
          PROVIDER_ID,
          false,
        );
      }
      const imageUrl = parsed.data.images[0].url;
      recordSuccess(PROVIDER_ID, this.keyRef);
      return {
        assetRef: imageUrl,
        provider: PROVIDER_ID,
        costCents: undefined,
        latencyMs: Date.now() - start,
        metadata: {
          model: this.model,
          seed: parsed.data.seed,
          timings: parsed.data.timings,
          width: parsed.data.images[0].width,
          height: parsed.data.images[0].height,
          contentType: parsed.data.images[0].content_type,
        },
      };
    } catch (err) {
      if (err instanceof ImageGenerationError) throw err;
      const kind = classifyError(err);
      recordFailure(PROVIDER_ID, kind, this.keyRef);
      const message = err instanceof Error ? err.message : String(err);
      const retryable = kind === FailureKind.RATE_LIMIT
        || kind === FailureKind.SERVER_ERROR
        || kind === FailureKind.TIMEOUT
        || kind === FailureKind.NETWORK;
      throw new ImageGenerationError(message, kind, PROVIDER_ID, retryable);
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
