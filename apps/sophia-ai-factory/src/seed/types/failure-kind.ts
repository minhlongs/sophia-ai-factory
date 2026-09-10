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
  /** Provider certification gate blocked instantiation */
  PROVIDER_NOT_CERTIFIED = 'PROVIDER_NOT_CERTIFIED',

  // ── Phase 11 Structured Failure Taxonomy ──────────────────────────────────
  /** Ownership / multi-tenant authorization failure */
  OWNERSHIP_FAILURE = 'OWNERSHIP_FAILURE',
  /** Billing, tier, or insufficient entitlement failure */
  BILLING_FAILURE = 'BILLING_FAILURE',
  /** BYOK provider credential missing, expired, or invalid */
  PROVIDER_AUTH_FAILURE = 'PROVIDER_AUTH_FAILURE',
  /** Requested AI capability not supported by configured providers */
  PROVIDER_CAPABILITY_FAILURE = 'PROVIDER_CAPABILITY_FAILURE',
  /** Mission execution or state machine lifecycle failure */
  MISSION_FAILURE = 'MISSION_FAILURE',
  /** Storage subsystem (R2 / object store) unavailable */
  STORAGE_FAILURE = 'STORAGE_FAILURE',
  /** Payment or external webhook processing failure */
  WEBHOOK_FAILURE = 'WEBHOOK_FAILURE',
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

  if (name === 'providernotcertifiederror' || msg.includes('provider_not_certified')) {
    return FailureKind.PROVIDER_NOT_CERTIFIED
  }
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
  if (msg.includes('ownership') || msg.includes('workspace_access_denied') || msg.includes('forbidden')) {
    return FailureKind.OWNERSHIP_FAILURE
  }
  if (msg.includes('billing') || msg.includes('insufficient_entitlement') || msg.includes('insufficient mcu')) {
    return FailureKind.BILLING_FAILURE
  }
  if (msg.includes('missing_provider_credential') || msg.includes('no_byok_credentials')) {
    return FailureKind.PROVIDER_AUTH_FAILURE
  }
  if (msg.includes('capability_not_supported') || msg.includes('unsupported capability')) {
    return FailureKind.PROVIDER_CAPABILITY_FAILURE
  }
  if (msg.includes('storage_unavailable') || msg.includes('r2_error')) {
    return FailureKind.STORAGE_FAILURE
  }
  if (msg.includes('webhook') || msg.includes('ipn_error') || msg.includes('nowpayments_error')) {
    return FailureKind.WEBHOOK_FAILURE
  }
  if (msg.includes('mission_failed') || msg.includes('execution_start_invalid') || msg.includes('mission error')) {
    return FailureKind.MISSION_FAILURE
  }

  return FailureKind.UNKNOWN
}

// ── Correlation Context & Propagation ───────────────────────────────────────

export interface CorrelationContext {
  correlationId: string;
  requestId?: string;
  missionId?: string;
  provider?: string;
  artifactId?: string;
  timestamp: number;
}

/**
 * Create or initialize a traceable correlation context.
 */
export function createCorrelationContext(
  params: Partial<CorrelationContext> & { correlationId?: string } = {}
): CorrelationContext {
  const correlationId =
    params.correlationId ??
    `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    correlationId,
    requestId: params.requestId,
    missionId: params.missionId,
    provider: params.provider,
    artifactId: params.artifactId,
    timestamp: params.timestamp ?? Date.now(),
  };
}

/**
 * Propagate correlation context forward through lifecycle stages:
 * request → mission → provider → artifact.
 */
export function propagateCorrelation(
  current: CorrelationContext,
  updates: Partial<Omit<CorrelationContext, 'correlationId' | 'timestamp'>>
): CorrelationContext {
  return {
    ...current,
    ...updates,
  };
}
