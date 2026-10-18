/**
 * Autonomous Engine Retry & Exponential Backoff Evaluator
 *
 * Layer: tree/autonomous (Pure domain engine, zero side effects)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * Formula:
 *   rawDelay = min(maxDelayMs, baseDelayMs * (factor ^ attempt))
 *   jitter   = rawDelay * jitterPct * randomFloat
 *   delayMs  = round(rawDelay + jitter)
 *
 * @module tree/autonomous/retry-backoff
 */

import type {
  BackoffConfig,
  RetryEvaluation,
} from '@/seed/types/autonomous-engine';
import { isRetryableError } from './retry-error-classifier';

export { isRetryableError };

export const DEFAULT_BACKOFF_CONFIG: BackoffConfig & { maxRetries: number } = {
  baseDelayMs: 60_000,      // 60 seconds base delay
  maxDelayMs: 1_800_000,   // 30 minutes max delay cap
  factor: 2.0,             // Exponential multiplier
  jitterPct: 0.2,          // Up to 20% jitter
  maxRetries: 3,           // Default max retry attempts
};

export interface BackoffEvaluationOptions extends Partial<BackoffConfig> {
  initialDelayMs?: number;
  backoffMultiplier?: number;
  maxRetries?: number;
  now?: number;
}

/**
 * Calculates exponential backoff delay with jitter for a given retry attempt.
 *
 * @param attempt 0-indexed attempt count (0 is first failure, retrying attempt 1)
 * @param options Configuration overrides (baseDelayMs, maxDelayMs, factor, jitterPct, maxRetries)
 * @param randomFloat Optional deterministic float in [0, 1] for testing (defaults to Math.random())
 */
export function calculateBackoff(
  attempt: number,
  options?: BackoffEvaluationOptions,
  randomFloat?: number
): RetryEvaluation {
  const baseDelayMs = options?.baseDelayMs ?? options?.initialDelayMs ?? DEFAULT_BACKOFF_CONFIG.baseDelayMs;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_BACKOFF_CONFIG.maxDelayMs;
  const factor = options?.factor ?? options?.backoffMultiplier ?? DEFAULT_BACKOFF_CONFIG.factor;
  const jitterPct = options?.jitterPct ?? DEFAULT_BACKOFF_CONFIG.jitterPct;
  const maxRetries = options?.maxRetries ?? DEFAULT_BACKOFF_CONFIG.maxRetries;
  const now = options?.now ?? Date.now();

  const safeAttempt = Math.max(0, Math.floor(attempt));
  const nextAttempt = safeAttempt + 1;
  const exhausted = safeAttempt >= maxRetries;

  if (exhausted) {
    return {
      shouldRetry: false,
      nextAttempt,
      delayMs: 0,
      nextRunAtMs: now,
      exhausted: true,
    };
  }

  // Calculate exponential backoff
  const rawDelay = Math.min(
    maxDelayMs,
    baseDelayMs * Math.pow(factor, safeAttempt)
  );

  // Apply full jitter within [0, rawDelay * jitterPct]
  const rnd = typeof randomFloat === 'number'
    ? Math.max(0, Math.min(1, randomFloat))
    : Math.random();

  const jitter = rawDelay * jitterPct * rnd;
  const delayMs = Math.round(Math.min(maxDelayMs, rawDelay + jitter));

  return {
    shouldRetry: true,
    nextAttempt,
    delayMs,
    nextRunAtMs: now + delayMs,
    exhausted: false,
  };
}
