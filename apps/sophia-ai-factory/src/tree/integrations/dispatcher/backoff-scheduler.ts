/**
 * Webhook Backoff Scheduler & Retry Policies
 *
 * Implements:
 * - 5-attempt exponential backoff schedule with configurable jitter.
 * - Retryable HTTP status evaluation (408, 429, 5xx).
 *
 * Layer: tree/integrations (Pure domain engine — imports only from @/seed and @/tree/)
 *
 * @module tree/integrations/dispatcher/backoff-scheduler
 */

export const MAX_DELIVERY_ATTEMPTS = 5;

// Base retry delays in milliseconds for attempts 1 through 5:
// Attempt 1: immediate (0s)
// Attempt 2: 30s
// Attempt 3: 120s (2m)
// Attempt 4: 600s (10m)
// Attempt 5: 3600s (1h)
export const BACKOFF_BASE_DELAYS_MS: readonly number[] = [
  0,
  30_000,
  120_000,
  600_000,
  3_600_000,
] as const;

/**
 * Computes next backoff delay in milliseconds for a given attempt number (1-based).
 * Jitter adds up to ±10% variation.
 */
export function calculateNextBackoffDelayMs(
  attemptNumber: number,
  options: {
    enableJitter?: boolean;
    jitterFraction?: number;
  } = {}
): number {
  if (attemptNumber < 1) return 0;
  if (attemptNumber > MAX_DELIVERY_ATTEMPTS) return 0;

  const baseDelay = BACKOFF_BASE_DELAYS_MS[attemptNumber - 1] ?? 0;
  if (baseDelay === 0) return 0;

  if (options.enableJitter === false) {
    return baseDelay;
  }

  const jitterRange = options.jitterFraction ?? 0.1; // ±10%
  const jitterFactor = 1 + (Math.random() * 2 - 1) * jitterRange;
  return Math.round(baseDelay * jitterFactor);
}

/**
 * Checks whether an HTTP status code should trigger a retry.
 * Non-retryable 4xx (400, 401, 403, 404, 410, etc.) abort immediately.
 * 408 (Timeout) and 429 (Rate Limit) are retryable.
 * 5xx server errors are retryable.
 */
export function isRetryableHttpStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}
