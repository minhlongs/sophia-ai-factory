/**
 * Retry backoff math for failed agent runs.
 *
 * Layer: tree (domain-specific reusable) — PURE module: no I/O, no clocks,
 * fully deterministic so orchestrators (rollback cron today, production graph
 * runner later) share one policy and tests need zero mocks.
 *
 * Policy: exponential backoff with a hard cap.
 *
 *   delay(retryCount) = min(30 min, 5 min · 2^retryCount)
 *
 *   retryCount 0 → 5 min · 1 → 10 min · 2 → 20 min · ≥3 → capped at 30 min
 *
 * All inputs/outputs are epoch MILLISECONDS. Callers converting from
 * agent_runs.ended_at (stored in seconds) must multiply by 1000 first.
 *
 * @module tree/mission/retry-backoff
 */

/** Delay before the FIRST automatic retry (5 minutes). */
export const BASE_RETRY_DELAY_MS = 5 * 60 * 1000;

/** Hard cap on any single retry delay (30 minutes). */
export const MAX_RETRY_DELAY_MS = 30 * 60 * 1000;

/**
 * Epoch-ms timestamp at which a run that failed at `endedAtMs` becomes
 * eligible for its next automatic retry after `retryCount` prior retries.
 * Deterministic: identical inputs always yield an identical timestamp.
 */
export function nextRetryAtMs(endedAtMs: number, retryCount: number): number {
  const attempt = Math.max(0, Math.floor(retryCount));
  const delay = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * Math.pow(2, attempt));
  return endedAtMs + delay;
}

/**
 * Whether a failed run is due for its next automatic retry by `nowMs`.
 * Due means the backoff window has fully elapsed:
 * nowMs >= endedAt + delay(retryCount).
 */
export function isRetryDue(args: {
  /** Run failure time in epoch milliseconds (agent_runs.ended_at × 1000). */
  endedAt: number;
  retryCount: number;
  /** Evaluation clock in epoch milliseconds. */
  nowMs: number;
}): boolean {
  return args.nowMs >= nextRetryAtMs(args.endedAt, args.retryCount);
}

/**
 * Whether a run has consumed every automatic retry allowed for it.
 * `maxAutoRetries = 0` means never auto-retry: any run is immediately
 * terminal. Callers decide what terminal means (rollback cron flips such runs
 * to 'cancelled' with error code RETRIES_EXHAUSTED).
 */
export function isRetriesExhausted(retryCount: number, maxAutoRetries: number): boolean {
  return retryCount >= maxAutoRetries;
}
