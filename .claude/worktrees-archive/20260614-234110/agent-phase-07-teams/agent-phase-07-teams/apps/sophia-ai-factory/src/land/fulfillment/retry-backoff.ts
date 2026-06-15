/**
 * Retry backoff schedule for fulfillment retry cron.
 * Pure functions — no side effects, fully testable.
 *
 * Backoff schedule (seconds after last attempt):
 *   attempt 1 → +30s
 *   attempt 2 → +60s (1min)
 *   attempt 3 → +300s (5min)
 *   attempt 4 → +900s (15min)
 *   attempt 5+ → +3600s (1h)
 *
 * @module lib/fulfillment/retry-backoff
 */

/** Max retry attempts before marking failed_permanent */
export const MAX_ATTEMPTS = 5

/** Backoff delays in seconds indexed by zero-based attempt index */
const BACKOFF_SCHEDULE_SEC = [30, 60, 300, 900, 3600] as const

/**
 * Returns the Unix epoch second at which the next retry should be attempted.
 * Returns 0 if this is the first attempt (no lastAttemptAt) — retry immediately.
 */
export function nextRetryAt(attemptCount: number, lastAttemptAt: number | null): number {
  if (lastAttemptAt === null || lastAttemptAt === 0) return 0
  const idx = Math.min(attemptCount - 1, BACKOFF_SCHEDULE_SEC.length - 1)
  const delaySeconds = BACKOFF_SCHEDULE_SEC[Math.max(0, idx)]
  return lastAttemptAt + delaySeconds
}

/**
 * Returns true if a retry is due based on current time and attempt history.
 */
export function isRetryDue(
  attemptCount: number,
  lastAttemptAt: number | null,
  nowSeconds: number,
): boolean {
  if (attemptCount >= MAX_ATTEMPTS) return false
  return nowSeconds >= nextRetryAt(attemptCount, lastAttemptAt)
}
