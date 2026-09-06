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
 * Typed error class for image generation failures.
 *
 * Carries a machine-readable error code for programmatic handling
 * (e.g. retry decisions, circuit breaker integration).
 */
export class ImageGenerationError extends Error {
  public readonly code: string;
  public readonly provider: string;
  public readonly retryable: boolean;

  constructor(message: string, code: string, provider: string, retryable: boolean = false) {
    super(message);
    this.name = 'ImageGenerationError';
    this.code = code;
    this.provider = provider;
    this.retryable = retryable;

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ImageGenerationError.prototype);
  }

  /**
   * Create an error from an unknown caught value.
   */
  static fromUnknown(error: unknown, provider: string): ImageGenerationError {
    if (error instanceof ImageGenerationError) {
      return error;
    }
    if (error instanceof Error) {
      return new ImageGenerationError(error.message, 'UNKNOWN_ERROR', provider, false);
    }
    return new ImageGenerationError(String(error), 'UNKNOWN_ERROR', provider, false);
  }
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

  /**
   * Generate an image from the given input.
   *
   * @param input — Prompt and optional parameters.
   * @returns Result with assetRef, cost, latency, and metadata.
   * @throws {ImageGenerationError} — with code indicating failure kind.
   */
  generate(input: ImageGenerationInput): Promise<ImageGenerationResult>;

  /**
   * Return the static capability profile for this provider.
   *
   * Capabilities are resolved at registration time and do not change at runtime.
   */
  capabilities(): ProviderCapabilities;

  /**
   * Check provider health.
   *
   * Used by the registry for fallback decisions.
   */
  health(): Promise<HealthStatus>;
}

/**
 * Type guard for ImageGenerationError.
 */
export function isImageGenerationError(error: unknown): error is ImageGenerationError {
  return error instanceof ImageGenerationError;
}