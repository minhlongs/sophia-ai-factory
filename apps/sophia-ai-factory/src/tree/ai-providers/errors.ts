/**
 * AI Provider Error — typed errors with error codes for circuit breaker
 * and retry classification across all AI provider operations.
 *
 * @module tree/ai-providers/errors
 */

export enum AIProviderErrorCode {
  /** D1 database unavailable or connection failure */
  D1_UNAVAILABLE = 'D1_UNAVAILABLE',
  /** Requested provider ID not found in registry */
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  /** Provider rate limit exceeded (HTTP 429) */
  RATE_LIMITED = 'RATE_LIMITED',
  /** Provider authentication failed (HTTP 401/403) */
  AUTH_FAILURE = 'AUTH_FAILURE',
  /** Provider returned unparseable or unexpected response */
  INVALID_RESPONSE = 'INVALID_RESPONSE',
}

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode
  readonly providerId?: string
  readonly retryable: boolean

  constructor(
    code: AIProviderErrorCode,
    message: string,
    opts?: { providerId?: string; retryable?: boolean; cause?: Error },
  ) {
    super(message, { cause: opts?.cause })
    this.name = 'AIProviderError'
    this.code = code
    this.providerId = opts?.providerId
    this.retryable = opts?.retryable ?? code === AIProviderErrorCode.RATE_LIMITED
  }
}
