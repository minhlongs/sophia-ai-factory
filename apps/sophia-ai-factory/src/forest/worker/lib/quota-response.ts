/**
 * Quota Response Builder - Standardized 429 Responses
 *
 * Creates consistent quota exceeded responses with proper
 * Retry-After and X-RateLimit-* headers.
 */

import { OverageResult } from './overage-calculator';
import {
  DEFAULT_RETRY_AFTER,
  parseRetryAfter,
  isQuotaExceededResponse,
  extractQuotaInfo,
} from './quota-header-parsers';

export { parseRetryAfter, isQuotaExceededResponse, extractQuotaInfo };

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
  retryAfter: number;
  upgradeUrl: string;
  overage?: {
    count: number;
    fee: number;
    isOverHardLimit: boolean;
  };
}

/**
 * Build standardized 429 quota exceeded response
 */
export function buildQuotaExceededResponse(
  overage: OverageResult,
  retryAfterSeconds: number = DEFAULT_RETRY_AFTER,
  upgradeUrl: string = '/dashboard/billing',
): Response {
  const resetTimestamp = Date.now() + retryAfterSeconds * 1000;
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
      current: overage.currentUsage,
    },
    remaining: {
      monthlyCredits: 0,
    },
    retryAfter: retryAfterSeconds,
    upgradeUrl,
  };

  if (overage.overageCount > 0) {
    body.overage = {
      count: overage.overageCount,
      fee: overage.overageFee,
      isOverHardLimit: overage.isOverHardLimit,
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
      'X-RateLimit-Hard-Limit': overage.isOverHardLimit ? 'true' : 'false',
    },
  });
}

/**
 * Build quota info headers for successful responses
 */
export function buildQuotaInfoHeaders(overage: OverageResult): Headers {
  const resetTimestamp = Date.now() + DEFAULT_RETRY_AFTER;
  const resetDate = new Date(resetTimestamp).toISOString();

  const headers = new Headers();
  headers.set('X-RateLimit-Limit', overage.baseLimit.toString());
  headers.set('X-RateLimit-Remaining', overage.remaining.toString());
  headers.set('X-RateLimit-Reset', resetDate);

  if (overage.overageCount > 0) {
    headers.set('X-RateLimit-Overage-Count', overage.overageCount.toString());
    headers.set('X-RateLimit-Overage-Fee', overage.overageFee.toString());
  }

  return headers;
}
