import { NextResponse } from 'next/server';
import { RateLimitConfig, RateLimitResult } from './types';
import { TokenBucketStore } from './token-bucket-store';
import { evaluateSlidingWindow } from './sliding-window-evaluator';
import {
  getClientIdentifier,
  checkAuthRateLimit,
  ADMIN_RATE_LIMIT_CONFIG,
  checkAdminRateLimit,
} from './endpoint-rate-limiters';

export {
  getClientIdentifier,
  checkAuthRateLimit,
  ADMIN_RATE_LIMIT_CONFIG,
  checkAdminRateLimit,
};

export class RateLimiter {
  private store: TokenBucketStore;

  constructor(maxCacheSize = 10000) {
    this.store = new TokenBucketStore(maxCacheSize);
  }

  checkLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();

    if (globalThis.process?.env?.DISABLE_RATE_LIMIT === 'true') {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: now + config.intervalMs,
      };
    }

    const entry = this.store.get(key);
    const { updatedEntry, result } = evaluateSlidingWindow(entry, config, now);
    this.store.set(key, updatedEntry);

    return result;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.remaining + (result.allowed ? 0 : 1)),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  };

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const headers = createRateLimitHeaders(result);

  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers,
    },
  );
}

export const globalRateLimiter = new RateLimiter();
