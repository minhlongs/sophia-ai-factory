/**
 * Exponential backoff retry wrapper.
 *
 * Retries up to `maxRetries` times with exponential delay + optional jitter.
 * Delay is capped at `maxDelayMs` to respect CF Workers CPU time limits.
 *
 * BreakerOpenError is NOT retried — circuit is open, retrying is pointless
 * and wastes CF Workers CPU budget.
 *
 * @module seed/utils/retry-with-backoff
 */

import { BreakerOpenError } from './circuit-breaker';

export interface RetryConfig {
  /** Max number of retry attempts (not counting the first attempt). Default: 3 */
  maxRetries: number;
  /** Base delay in ms before first retry. Default: 1000 */
  baseDelayMs: number;
  /** Max delay in ms between retries. Default: 10000 */
  maxDelayMs: number;
  /** Add random jitter to avoid thundering herd. Default: true */
  jitter: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 10_000,
  jitter: true,
};

function calcDelay(attempt: number, config: RetryConfig): number {
  // Exponential: base * 2^attempt
  const exponential = config.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, config.maxDelayMs);
  if (!config.jitter) return capped;
  // Add up to 20% jitter to spread retries
  return capped * (0.8 + Math.random() * 0.4);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `fn` with bounded exponential backoff retry.
 *
 * @param fn     Async function to retry on failure
 * @param config Retry configuration (all fields optional)
 * @returns      Resolved value from `fn` on success
 * @throws       Last error if all retries exhausted, or BreakerOpenError immediately
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastErr: unknown;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // Never retry on BreakerOpenError — upstream is known-degraded
      if (err instanceof BreakerOpenError) {
        throw err;
      }
      lastErr = err;
      if (attempt < cfg.maxRetries) {
        await sleep(calcDelay(attempt, cfg));
      }
    }
  }

  throw lastErr;
}
