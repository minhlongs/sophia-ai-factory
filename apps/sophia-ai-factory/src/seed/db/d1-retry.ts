/**
 * Cloudflare D1 Transient SQLite Error Retry Wrapper.
 *
 * Catches transient SQLite lock contention (`SQLITE_BUSY`, `database is locked`,
 * `D1_ERROR`) and retries operations with jittered exponential backoff.
 * Non-transient errors (syntax errors, constraints, schema errors) fail-fast immediately.
 *
 * @module seed/db/d1-retry
 */

import { logger } from '@/seed/utils/logger-utility';

export interface D1RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in ms before the first retry (default: 50) */
  baseDelayMs: number;
  /** Maximum delay in ms between retries (default: 500) */
  maxDelayMs: number;
  /** Add random jitter to prevent lock thundering herds (default: true) */
  jitter: boolean;
  /** Optional callback invoked on each retry */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export const DEFAULT_D1_RETRY_OPTIONS: D1RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 50,
  maxDelayMs: 500,
  jitter: true,
};

/**
 * Determines if an error represents a transient SQLite lock or connection error
 * that is safe to retry.
 */
export function isD1TransientError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  return (
    msg.includes('database is locked') ||
    msg.includes('sqlite_busy') ||
    msg.includes('sqlite_locked') ||
    (msg.includes('d1_error') && (msg.includes('locked') || msg.includes('busy'))) ||
    msg.includes('resource temporarily unavailable') ||
    msg.includes('network connection error') ||
    msg.includes('timed out') ||
    msg.includes('connection reset') ||
    msg.includes('fetch failed')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(attempt: number, opts: D1RetryOptions): number {
  const exponential = opts.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, opts.maxDelayMs);
  if (!opts.jitter) return capped;
  // Jitter factor between 0.75 and 1.25
  const jitterFactor = 0.75 + Math.random() * 0.5;
  return Math.round(capped * jitterFactor);
}

/**
 * Executes a D1 database operation with exponential backoff retries on transient errors.
 *
 * @param operation - The async database function to execute
 * @param options - Custom retry configuration
 * @returns Result of the operation
 */
export async function withD1Retry<T>(
  operation: () => Promise<T>,
  options?: Partial<D1RetryOptions>,
): Promise<T> {
  const opts: D1RetryOptions = { ...DEFAULT_D1_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      // Fail-fast immediately on non-transient errors (e.g. constraints, syntax, column missing)
      if (!isD1TransientError(err)) {
        throw err;
      }

      // If retries exhausted, throw
      if (attempt >= opts.maxRetries) {
        logger.warn('[D1Retry] Exhausted retries for transient D1 error', {
          attempt,
          maxRetries: opts.maxRetries,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }

      const delayMs = computeDelay(attempt, opts);
      if (opts.onRetry) {
        try {
          opts.onRetry(err, attempt + 1, delayMs);
        } catch {
          // ignore callback error
        }
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}
