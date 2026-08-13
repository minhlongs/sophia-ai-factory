/**
 * Failure Classification Types
 *
 * Per-kind error classification for circuit breaker and retry logic.
 * Derived from OmniRoute's combo dispatch pattern: different HTTP status
 * codes trigger different responses — 401 stops, 429 cools down, 5xx retries.
 *
 * @module seed/types/failure-kind
 */

/** Classification of external service failure types */
export enum FailureKind {
  /** HTTP 429 — provider rate limit hit, short cooldown */
  RATE_LIMIT = 'RATE_LIMIT',
  /** HTTP 5xx — server error, longer cooldown */
  SERVER_ERROR = 'SERVER_ERROR',
  /** HTTP 401/403 — invalid key or unauthorized, immediate circuit open */
  AUTH_FAILURE = 'AUTH_FAILURE',
  /** Request timeout — medium cooldown */
  TIMEOUT = 'TIMEOUT',
  /** Network-level failure (DNS, connection refused, TLS) */
  NETWORK = 'NETWORK',
  /** Unclassified — default fallback */
  UNKNOWN = 'UNKNOWN',
}

/** Circuit breaker states — 4-state machine */
export enum CircuitState {
  /** Normal operation, all requests allowed */
  CLOSED = 'CLOSED',
  /** Some failures detected, reduced capacity (optional future use) */
  DEGRADED = 'DEGRADED',
  /** Too many failures, all requests skipped */
  OPEN = 'OPEN',
  /** Cooldown expired, testing with a single probe request */
  HALF_OPEN = 'HALF_OPEN',
}

/** Classify an HTTP status code into a FailureKind */
export function classifyHttpStatus(status: number): FailureKind {
  if (status === 401 || status === 403) return FailureKind.AUTH_FAILURE
  if (status === 429) return FailureKind.RATE_LIMIT
  if (status >= 500) return FailureKind.SERVER_ERROR
  if (status === 408) return FailureKind.TIMEOUT
  return FailureKind.UNKNOWN
}

/** Classify a caught error into a FailureKind */
export function classifyError(error: unknown): FailureKind {
  if (!(error instanceof Error)) return FailureKind.UNKNOWN

  const msg = error.message.toLowerCase()
  const name = error.name.toLowerCase()

  if (name === 'aborterror' || msg.includes('timeout') || msg.includes('timed out')) {
    return FailureKind.TIMEOUT
  }
  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('network')) {
    return FailureKind.NETWORK
  }
  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized')) {
    return FailureKind.AUTH_FAILURE
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return FailureKind.RATE_LIMIT
  }
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return FailureKind.SERVER_ERROR
  }

  return FailureKind.UNKNOWN
}
