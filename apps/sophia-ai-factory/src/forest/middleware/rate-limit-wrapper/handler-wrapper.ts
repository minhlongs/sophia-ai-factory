import { NextRequest, NextResponse } from 'next/server';
import {
  globalRateLimiter,
  getClientIdentifier,
  createRateLimitResponse,
  createRateLimitHeaders,
} from '../rate-limiter';
import { getRateLimitConfig } from '../rate-limit-config';
import type { RateLimitOptions } from './types';
import { getRequestPathname, shouldBypassRateLimit } from './url-helper';

/**
 * Wrap an API route handler with rate limiting
 */
export function withRateLimit<T extends NextResponse>(
  handler: (request: NextRequest) => Promise<T>,
  options: RateLimitOptions = {}
) {
  return async function wrappedHandler(request: NextRequest): Promise<T | NextResponse> {
    if (options.skip) {
      return handler(request);
    }

    const pathname = getRequestPathname(request);
    if (shouldBypassRateLimit(pathname, options.skip)) {
      return handler(request);
    }

    const config = options.config || getRateLimitConfig(pathname);
    const clientKey = options.key || getClientIdentifier(request);
    const result = globalRateLimiter.checkLimit(clientKey, config);

    const headers = options.addHeaders !== false ? createRateLimitHeaders(result) : {};

    if (!result.allowed) {
      if (options.onRateLimited) {
        return options.onRateLimited(result.retryAfter) as T | NextResponse;
      }
      return createRateLimitResponse(result) as T | NextResponse;
    }

    const response = await handler(request);

    try {
      const hasHeaders =
        options.addHeaders !== false &&
        response &&
        typeof (response as { headers?: { set?: (k: string, v: string) => void } }).headers?.set === 'function';
      if (hasHeaders) {
        Object.entries(headers).forEach(([key, value]) => {
          (response as NextResponse).headers.set(key, value);
        });
      }
    } catch {
      /* mocked Response — skip header injection */
    }

    return response;
  };
}
