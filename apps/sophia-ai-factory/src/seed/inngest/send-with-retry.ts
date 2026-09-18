/**
 * Inngest Edge Worker Dispatch Retry Helper
 *
 * Catches transient network disruptions, socket timeouts, and upstream
 * rate limits when emitting events to Inngest Cloud from Cloudflare Workers edge.
 *
 * Non-transient errors (bad payload, unauthorized, validation failure) fail-fast.
 *
 * Layer: seed (foundational — zero domain imports)
 *
 * @module seed/inngest/send-with-retry
 */

import { logger } from '@/seed/utils/logger-utility';

export interface InngestRetryOptions {
  /** Maximum number of retry attempts (default: 2) */
  maxRetries?: number;
  /** Initial delay in ms before the first retry (default: 100) */
  baseDelayMs?: number;
  /** Maximum delay in ms between retries (default: 500) */
  maxDelayMs?: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Optional callback invoked on each retry */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export const DEFAULT_INNGEST_RETRY_OPTIONS: Required<InngestRetryOptions> = {
  maxRetries: 2,
  baseDelayMs: 100,
  maxDelayMs: 500,
  jitter: true,
  onRetry: () => {},
};

/**
 * Determines whether an error from inngest.send() represents a transient
 * network or gateway condition that can be safely retried.
 */
export function isTransientInngestError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  return (
    msg.includes('fetch failed') ||
    msg.includes('network connection error') ||
    msg.includes('network error') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('connection reset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('unreachable') ||
    msg.includes('inngest down') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('bad gateway') ||
    msg.includes('gateway timeout') ||
    msg.includes('service unavailable')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(attempt: number, opts: Required<InngestRetryOptions>): number {
  const exponential = opts.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, opts.maxDelayMs);
  if (!opts.jitter) return capped;
  const jitterAmount = Math.random() * (opts.baseDelayMs * 0.5);
  return Math.floor(capped + jitterAmount);
}

/**
 * Executes an Inngest send operation with automatic retry on transient failures.
 *
 * @param sendFn - Async function executing inngest.send()
 * @param options - Custom retry configuration
 * @returns Result of sendFn
 * @throws The last encountered error when all retries are exhausted or on non-transient error
 */
export async function sendInngestWithRetry<T>(
  sendFn: () => Promise<T>,
  options?: InngestRetryOptions,
): Promise<T> {
  const opts: Required<InngestRetryOptions> = {
    ...DEFAULT_INNGEST_RETRY_OPTIONS,
    ...options,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await sendFn();
    } catch (err: unknown) {
      lastError = err;

      if (attempt >= opts.maxRetries || !isTransientInngestError(err)) {
        throw err;
      }

      const delayMs = computeDelay(attempt, opts);

      logger.warn('[InngestRetry] Transient dispatch failure, retrying', {
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
        delayMs,
        error: err instanceof Error ? err.message : String(err),
      });

      if (opts.onRetry) {
        opts.onRetry(err, attempt + 1, delayMs);
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}
