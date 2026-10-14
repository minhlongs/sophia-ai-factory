import { NextRequest, NextResponse } from 'next/server';
import {
  globalRateLimiter,
  getClientIdentifier,
  createRateLimitResponse,
  type RateLimitConfig,
} from '../rate-limiter';
import { getRateLimitConfig, shouldSkipRateLimit } from '../rate-limit-config';
import type { RateLimitOptions, RateLimitStatus } from './types';

/**
 * Check rate limit without wrapping a handler
 * Returns error response if rate limited, null if allowed
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
): NextResponse | null {
  const pathname = new URL(request.url).pathname;

  if (options.skip || shouldSkipRateLimit(pathname)) {
    return null;
  }

  const config = options.config || getRateLimitConfig(pathname);
  const clientKey = options.key || getClientIdentifier(request);
  const result = globalRateLimiter.checkLimit(clientKey, config);

  if (!result.allowed) {
    if (options.onRateLimited) {
      return options.onRateLimited(result.retryAfter);
    }
    return createRateLimitResponse(result);
  }

  return null;
}

/**
 * Get current rate limit status for a client
 */
export function getRateLimitStatus(
  request: NextRequest,
  config?: RateLimitConfig
): RateLimitStatus {
  const pathname = new URL(request.url).pathname;
  const limitConfig = config || getRateLimitConfig(pathname);

  const now = Date.now();
  return {
    limit: limitConfig.maxRequests,
    remaining: limitConfig.maxRequests,
    resetAt: now + limitConfig.intervalMs,
    resetInSeconds: Math.ceil(limitConfig.intervalMs / 1000),
  };
}

/**
 * Middleware function for Next.js middleware.ts
 */
export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith('/api/')) {
    return null;
  }

  if (shouldSkipRateLimit(pathname)) {
    return null;
  }

  const config = getRateLimitConfig(pathname);
  const clientKey = getClientIdentifier(request);
  const result = globalRateLimiter.checkLimit(clientKey, config);

  if (!result.allowed) {
    return createRateLimitResponse(result);
  }

  return null;
}
