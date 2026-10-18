/**
 * Autonomous Engine Transient Error Classifier
 *
 * Layer: tree/autonomous (Pure domain engine, zero side effects)
 *
 * @module tree/autonomous/retry-error-classifier
 */

const NON_RETRYABLE_PATTERNS = [
  'invalid_api_key',
  'unauthorized',
  'forbidden',
  'invalid credentials',
  'not_found',
  'syntax',
  'validation',
];

const RETRYABLE_PATTERNS = [
  'timeout',
  'network',
  'rate limit',
  '429',
  '500',
  '502',
  '503',
  '504',
  'econnreset',
  'etimedout',
  'fetch failed',
];

/**
 * Classifies whether an error is transient and retryable or permanent.
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  for (const pattern of NON_RETRYABLE_PATTERNS) {
    if (message.includes(pattern)) {
      return false;
    }
  }

  for (const pattern of RETRYABLE_PATTERNS) {
    if (message.includes(pattern)) {
      return true;
    }
  }

  return false;
}
