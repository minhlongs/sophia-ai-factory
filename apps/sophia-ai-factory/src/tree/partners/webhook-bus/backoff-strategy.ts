/**
 * Exponential Backoff & Retry Classification
 *
 * Layer: tree (domain business logic & retry policies)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/webhook-bus/backoff-strategy
 */

import { BACKOFF_BASE_DELAYS_MS } from './types';

/**
 * Calculates next backoff delay for attempts 1 through 5.
 *
 * @param attempt - Current attempt number (1-based: 1, 2, 3, 4, 5)
 * @param withJitter - Whether to apply ±20% randomization to prevent thundering herds
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelayMs(attempt: number, withJitter = false): number {
  if (attempt <= 1) {
    return BACKOFF_BASE_DELAYS_MS[0]; // 0ms
  }

  const index = Math.min(attempt - 1, BACKOFF_BASE_DELAYS_MS.length - 1);
  const baseDelay = BACKOFF_BASE_DELAYS_MS[index];

  if (!withJitter) {
    return baseDelay;
  }

  // Jitter between 80% and 120% of base delay
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.floor(baseDelay * jitterFactor);
}

/**
 * Checks whether an HTTP status code is retryable.
 * - 429 (Too Many Requests), 500, 502, 503, 504 are retryable.
 * - 400, 401, 403, 404, 422 are non-retryable client errors and fail immediately.
 */
export function isRetryableHttpStatus(status: number): boolean {
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}
