/**
 * Exponential backoff schedule for webhook delivery retries.
 * Max 5 attempts with delays: 30s, 2m, 10m, 1h, 6h.
 * @module lib/webhooks/retry
 */

/** Delay schedule in milliseconds, indexed by attempt number (1-based) */
const RETRY_DELAYS_MS = [
  30_000,      // attempt 2 → 30 seconds
  120_000,     // attempt 3 → 2 minutes
  600_000,     // attempt 4 → 10 minutes
  3_600_000,   // attempt 5 → 1 hour
  21_600_000,  // attempt 6 (dead-letter after this) → 6 hours
];

export const MAX_ATTEMPTS = 5;

/**
 * Return the delay in milliseconds before the next retry.
 * @param attemptNum The attempt that just failed (1-based).
 *                   Returns 0 if no more retries should be scheduled.
 */
export function nextRetryDelay(attemptNum: number): number {
  if (attemptNum >= MAX_ATTEMPTS) return 0;
  return RETRY_DELAYS_MS[attemptNum - 1] ?? 0;
}

/**
 * Calculate the ISO timestamp for the next retry given the current attempt.
 * Returns null if max attempts reached.
 */
export function nextRetryAt(attemptNum: number): string | null {
  const delayMs = nextRetryDelay(attemptNum);
  if (delayMs === 0) return null;
  return new Date(Date.now() + delayMs).toISOString();
}

/**
 * Determine whether an attempt has exceeded the max retry limit.
 */
export function isDeadLetter(attemptNum: number): boolean {
  return attemptNum >= MAX_ATTEMPTS;
}
