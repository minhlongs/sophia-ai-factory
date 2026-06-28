/**
 * Quota Response Builder - Standardized 429 Responses
 *
 * Creates consistent quota exceeded responses with proper
 * Retry-After and X-RateLimit-* headers.
 */

import { OverageResult } from './overage-calculator';

/**
 * Quota exceeded error response body
 */
export interface QuotaExceededBody {
  error: 'quota_exceeded';
  code: 'QUOTA_EXCEEDED';
  message: string;
  exceeded: {
    type: 'monthly_credits';
    limit: number;
    current: number;
  };
  remaining: {
    monthlyCredits: number;
  };
  retryAfter: number;          // Seconds until reset
  upgradeUrl: string;          // URL to upgrade page
  overage?: {
    count: number;
    fee: number;
    isOverHardLimit: boolean;
  };
}

/**
 * Default retry period (30 days in seconds)
 * Reset occurs on 1st of next month
 */
const DEFAULT_RETRY_AFTER = 2592000;

/**
 * Build standardized 429 quota exceeded response
 *
 * @param overage - Overage calculation result
 * @param retryAfterSeconds - Seconds until quota reset (optional)
 * @param upgradeUrl - URL to billing/upgrade page (optional)
 * @returns Response with 429 status and proper headers
 */
export function buildQuotaExceededResponse(
  overage: OverageResult,
  retryAfterSeconds: number = DEFAULT_RETRY_AFTER,
  upgradeUrl: string = '/dashboard/billing'
): Response {
  const resetTimestamp = Date.now() + (retryAfterSeconds * 1000);
  const resetDate = new Date(resetTimestamp).toISOString();

  const body: QuotaExceededBody = {
    error: 'quota_exceeded',
    code: 'QUOTA_EXCEEDED',
    message: overage.isOverHardLimit
      ? 'Monthly usage limit exceeded. Hard limit reached.'
      : 'Monthly usage limit exceeded',
    exceeded: {
      type: 'monthly_credits',
      limit: overage.baseLimit,
      current: overage.currentUsage
    },
    remaining: {
      monthlyCredits: 0
    },
    retryAfter: retryAfterSeconds,
    upgradeUrl
  };

  // Add overage details if applicable
  if (overage.overageCount > 0) {
    body.overage = {
      count: overage.overageCount,
      fee: overage.overageFee,
      isOverHardLimit: overage.isOverHardLimit
    };
  }

  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfterSeconds.toString(),
      'X-RateLimit-Limit': overage.baseLimit.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': resetDate,
      'X-RateLimit-Overage-Count': overage.overageCount.toString(),
      'X-RateLimit-Overage-Fee': overage.overageFee.toString(),
      'X-RateLimit-Hard-Limit': overage.isOverHardLimit ? 'true' : 'false'
    }
  });
}

/**
 * Build quota info headers for successful responses
 * Add these headers to 200 OK responses to show remaining quota
 */
export function buildQuotaInfoHeaders(overage: OverageResult): Headers {
  const resetTimestamp = Date.now() + DEFAULT_RETRY_AFTER;
  const resetDate = new Date(resetTimestamp).toISOString();

  const headers = new Headers();
  headers.set('X-RateLimit-Limit', overage.baseLimit.toString());
  headers.set('X-RateLimit-Remaining', overage.remaining.toString());
  headers.set('X-RateLimit-Reset', resetDate);

  // Add overage info if applicable
  if (overage.overageCount > 0) {
    headers.set('X-RateLimit-Overage-Count', overage.overageCount.toString());
    headers.set('X-RateLimit-Overage-Fee', overage.overageFee.toString());
  }

  return headers;
}

/**
 * Parse retry-after header value
 * Handles both numeric seconds and HTTP date formats
 */
export function parseRetryAfter(headerValue: string | null): number {
  if (!headerValue) {
    return DEFAULT_RETRY_AFTER;
  }

  // Try parsing as numeric seconds first
  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds;
  }

  // Try parsing as HTTP date
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
  return response.status === 429 &&
    response.headers.get('X-RateLimit-Remaining') === '0';
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

  const info = {
    limit: parseInt(limit, 10) || 0,
    remaining: parseInt(remaining, 10) || 0,
    resetDate: reset
  };

  const overageCount = response.headers.get('X-RateLimit-Overage-Count');
  const overageFee = response.headers.get('X-RateLimit-Overage-Fee');

  if (overageCount) {
    (info as typeof info & { overageCount: number }).overageCount =
      parseInt(overageCount, 10) || 0;
  }

  if (overageFee) {
    (info as typeof info & { overageCount: number; overageFee: number }).overageFee =
      parseFloat(overageFee) || 0;
  }

  return info;
}
