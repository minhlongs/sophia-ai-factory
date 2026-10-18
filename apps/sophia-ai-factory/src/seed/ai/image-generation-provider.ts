/**
 * @module seed/ai/image-generation-provider
 *
 * Abstract provider interface for image generation.
 *
 * This is distinct from the text-oriented Provider interface — it focuses
 * exclusively on image generation capabilities and is implemented by
 * adapters such as MockImageGenerationProvider, MuAPIAdapter, OpenRouterImageAdapter.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import { ImageGenerationError, isImageGenerationError } from './image-generation-error';

export { ImageGenerationError, isImageGenerationError };

/**
 * Input parameters for image generation.
 */
export interface ImageGenerationInput {
  /** The text prompt describing the desired image. */
  prompt: string;
  /** Optional aspect ratio for the generated image. */
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3';
  /** Optional style hint (provider-specific interpretation). */
  style?: string;
  /** Optional idempotency key for deduplication. */
  idempotencyKey?: string;
  /** Optional request timeout in milliseconds. */
  timeoutMs?: number;
}

/**
 * Result returned by a successful image generation.
 *
 * Economic fields (costCents, costClassification, retryCount,
 * requestedAt, startedAt) are OPTIONAL so existing callers and tests
 * are not broken. When present they feed the economic control loop
 * (SUPREME COMMAND #9) with real data instead of NULL.
 */
export interface ImageGenerationResult {
  /** URL or reference to the generated image asset. */
  assetRef: string;
  /** Provider identifier that produced this result. */
  provider: string;
  /** Optional cost in cents (USD). */
  costCents?: number;
  /** Generation latency in milliseconds. */
  latencyMs: number;
  /** Optional provider-specific metadata. */
  metadata?: Record<string, unknown>;
  /** Cost classification (METERED / UNKNOWN / UNMETERED). */
  costClassification?: 'METERED' | 'UNKNOWN' | 'UNMETERED';
  /** Number of attempts made (1 = no retry, 3 = exhausted). */
  retryCount?: number;
  /** Epoch seconds when the request entered the provider lifecycle. */
  requestedAt?: number;
  /** Epoch seconds right before the actual HTTP fetch began. */
  startedAt?: number;
}

/**
 * Static capability profile for an image generation provider.
 */
export interface ProviderCapabilities {
  /** Whether the provider supports aspect ratio control. */
  supportsAspectRatio: boolean;
  /** Whether the provider supports style hints. */
  supportsStyle: boolean;
  /** Maximum concurrent requests the provider can handle. */
  maxConcurrency: number;
}

/**
 * Runtime health snapshot for a provider.
 */
export interface HealthStatus {
  /** Whether the provider is currently considered healthy. */
  healthy: boolean;
  /** Current average latency in milliseconds, if available. */
  latencyMs?: number;
  /** Error message if unhealthy, otherwise undefined. */
  error?: string;
}

/**
 * Abstract image generation provider.
 *
 * Every image generation service integration (Mock, MuAPI, OpenRouter, etc.)
 * implements this interface. The registry, health tracker, and orchestration
 * layer operate exclusively against this contract.
 *
 * Implementations MUST NOT throw for missing credentials at construction time —
 * they MAY throw at call time when credentials are actually needed, so that
 * providers can be registered before their credentials are configured.
 */
export interface ImageGenerationProvider {
  /** Stable provider identifier (matches the key used in the registry). */
  readonly id: string;
  /** Human-readable label for logs and UI. */
  readonly label: string;
  /** Generate an image from the given input. */
  generate(input: ImageGenerationInput): Promise<ImageGenerationResult>;
  /** Return the static capability profile for this provider. */
  capabilities(): ProviderCapabilities;
  /** Check provider health. */
  health(): Promise<HealthStatus>;
}
