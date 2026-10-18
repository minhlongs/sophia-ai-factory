/**
 * @module seed/ai/image-generation-error
 *
 * Typed error class and type guard for image generation failures.
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

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
  /** Number of attempts made before this error (1 = first try). Optional — not all callers track it. */
  public retryCount?: number;

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
 * Type guard for ImageGenerationError.
 */
export function isImageGenerationError(error: unknown): error is ImageGenerationError {
  return error instanceof ImageGenerationError;
}
