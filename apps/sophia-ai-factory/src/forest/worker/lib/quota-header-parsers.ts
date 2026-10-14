/**
 * Header parsing and inspection helpers for quota exceeded responses.
 * @module forest/worker/lib/quota-header-parsers
 */

/**
 * Default retry period (30 days in seconds)
 */
export const DEFAULT_RETRY_AFTER = 2592000;

/**
 * Parse retry-after header value
 * Handles both numeric seconds and HTTP date formats
 */
export function parseRetryAfter(headerValue: string | null): number {
  if (!headerValue) {
    return DEFAULT_RETRY_AFTER;
  }

  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds;
  }

  const date = new Date(headerValue);
  if (!isNaN(date.getTime())) {
    return Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
  }

  return DEFAULT_RETRY_AFTER;
}

/**
 * Check if response is a quota exceeded response
 */
export function isQuotaExceededResponse(response: Response): boolean {
  return (
    response.status === 429 &&
    response.headers.get('X-RateLimit-Remaining') === '0'
  );
}

/**
 * Extract quota info from response headers
 */
export function extractQuotaInfo(response: Response): {
  limit: number;
  remaining: number;
  resetDate: string;
  overageCount?: number;
  overageFee?: number;
} | null {
  const limit = response.headers.get('X-RateLimit-Limit');
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');

  if (!limit || !remaining || !reset) {
    return null;
  }

  const info: {
    limit: number;
    remaining: number;
    resetDate: string;
    overageCount?: number;
    overageFee?: number;
  } = {
    limit: parseInt(limit, 10) || 0,
    remaining: parseInt(remaining, 10) || 0,
    resetDate: reset,
  };

  const overageCount = response.headers.get('X-RateLimit-Overage-Count');
  const overageFee = response.headers.get('X-RateLimit-Overage-Fee');

  if (overageCount) {
    info.overageCount = parseInt(overageCount, 10) || 0;
  }

  if (overageFee) {
    info.overageFee = parseFloat(overageFee) || 0;
  }

  return info;
}
