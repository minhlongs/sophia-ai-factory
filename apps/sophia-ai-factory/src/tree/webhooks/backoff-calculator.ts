/**
 * Resilient Webhook Exponential Backoff & Jitter Calculator
 *
 * Implements the enterprise retry schedule:
 * - Attempt 1: 30 seconds
 * - Attempt 2: 120 seconds (2 minutes)
 * - Attempt 3: 600 seconds (10 minutes)
 * - Attempt 4: 3600 seconds (1 hour)
 * - Attempt 5: 21600 seconds (6 hours)
 * - Max attempts: 5 (exhaustion transitions to Dead Letter Queue)
 *
 * Layer: tree/webhooks (Pure Domain Logic - only imports from @/seed)
 *
 * @module tree/webhooks/backoff-calculator
 */

export const BACKOFF_SCHEDULE_SECONDS: readonly number[] = [
  30,     // Attempt 1: 30s
  120,    // Attempt 2: 2m
  600,    // Attempt 3: 10m
  3600,   // Attempt 4: 1h
  21600,  // Attempt 5: 6h
] as const;

export const MAX_DELIVERY_ATTEMPTS = 5;
export const DEFAULT_JITTER_RATIO = 0.10; // +/- 10% bounds

/**
 * Calculates backoff delay in milliseconds for a given retry attempt count.
 *
 * @param attempt 1-based attempt number (1 to 5)
 * @param withJitter whether to apply +/- 10% pseudo-random or deterministic jitter
 * @param randomFn optional custom random generator (defaults to Math.random)
 * @returns delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  withJitter = false,
  randomFn?: () => number,
): number {
  // Clamped index between 0 and BACKOFF_SCHEDULE_SECONDS.length - 1
  const sanitizedAttempt = Math.max(1, Math.floor(attempt));
  const idx = Math.min(sanitizedAttempt - 1, BACKOFF_SCHEDULE_SECONDS.length - 1);
  const baseSeconds = BACKOFF_SCHEDULE_SECONDS[idx];
  const baseMs = baseSeconds * 1000;

  if (!withJitter) {
    return baseMs;
  }

  // Bounded jitter in range [0.90, 1.10]
  // Test F4-4 asserts: jittered >= base * 0.89 and jittered <= base * 1.15
  const rand = typeof randomFn === 'function' ? randomFn() : Math.random();
  const jitterFactor = (1 - DEFAULT_JITTER_RATIO) + (rand * (2 * DEFAULT_JITTER_RATIO));
  return Math.floor(baseMs * jitterFactor);
}

/**
 * Calculates next attempt timestamp in epoch milliseconds.
 */
export function calculateNextAttemptTimestamp(
  currentAttempt: number,
  nowMs = Date.now(),
  withJitter = true,
): number {
  return nowMs + calculateBackoffDelay(currentAttempt, withJitter);
}

/**
 * Evaluates whether an attempt count has exhausted max retry attempts and must transition to DLQ.
 */
export function isAttemptExhausted(attemptCount: number, maxAttempts = MAX_DELIVERY_ATTEMPTS): boolean {
  return attemptCount >= maxAttempts;
}

/**
 * Evaluates terminal outcome of a delivery attempt.
 */
export function evaluateAttemptStatus(
  attemptNumber: number,
  isOk: boolean,
  maxAttempts = MAX_DELIVERY_ATTEMPTS,
): {
  status: 'success' | 'failed' | 'dead_letter';
  isTerminal: boolean;
} {
  if (isOk) {
    return { status: 'success', isTerminal: true };
  }

  if (isAttemptExhausted(attemptNumber, maxAttempts)) {
    return { status: 'dead_letter', isTerminal: true };
  }

  return { status: 'failed', isTerminal: false };
}
