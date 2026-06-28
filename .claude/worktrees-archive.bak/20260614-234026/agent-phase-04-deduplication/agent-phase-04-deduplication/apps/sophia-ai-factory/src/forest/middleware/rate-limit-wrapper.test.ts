/**
 * Rate Limit Wrapper Tests
 * Integration tests for withRateLimit wrapper and middleware
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  withRateLimit,
  checkRateLimit,
  getRateLimitStatus,
  type RateLimitOptions
} from './rate-limit-wrapper';
import { globalRateLimiter } from './rate-limiter';

describe('withRateLimit', () => {
  const testHandler = vi.fn(async (request: NextRequest) => {
    return NextResponse.json({ success: true, message: 'Handler executed' });
  });

  const errorResponseHandler = vi.fn(async (request: NextRequest) => {
    return NextResponse.json({ error: 'Custom rate limited' }, { status: 429 });
  });

  beforeEach(() => {
    globalRateLimiter.clear();
    testHandler.mockClear();
    errorResponseHandler.mockClear();
  });

  afterEach(() => {
    globalRateLimiter.clear();
  });

  it('should execute handler when under limit', async () => {
    const wrappedHandler = withRateLimit(testHandler, {
      config: { intervalMs: 1000, maxRequests: 5 }
    });

    const request = new NextRequest(new URL('http://test.com/api/test'));
    const response = await wrappedHandler(request);

    expect(testHandler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);

    const data = (await response.json()) as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('should return 429 when rate limit exceeded', async () => {
    const config = { intervalMs: 1000, maxRequests: 2 };
    const wrappedHandler = withRateLimit(testHandler, { config });

    const url = 'http://test.com/api/rate-limited';

    // Make requests up to limit
    for (let i = 0; i < 2; i++) {
      const request = new NextRequest(new URL(url));
      await wrappedHandler(request);
    }

    // Next request should be rate limited
    const request = new NextRequest(new URL(url));
    const response = await wrappedHandler(request);

    expect(response.status).toBe(429);
    expect(testHandler).toHaveBeenCalledTimes(2);

    const data = (await response.json()) as { error: string };
    expect(data.error).toBe('Too Many Requests');
  });

  it('should skip rate limiting when skip option is true', async () => {
    const wrappedHandler = withRateLimit(testHandler, { skip: true });

    const request = new NextRequest(new URL('http://test.com/api/test'));

    // Make many requests - all should succeed
    for (let i = 0; i < 10; i++) {
      await wrappedHandler(request);
    }

    expect(testHandler).toHaveBeenCalledTimes(10);
  });

  it('should use custom key for rate limiting', async () => {
    const config = { intervalMs: 1000, maxRequests: 2 };
    const wrappedHandler = withRateLimit(testHandler, {
      config,
      key: 'custom-key'
    });

    const request1 = new NextRequest(new URL('http://test.com/api/test'));
    const request2 = new NextRequest(new URL('http://test.com/api/test'));

    // Both requests with same custom key should count against same limit
    await wrappedHandler(request1);
    await wrappedHandler(request2);

    // Third request should be blocked
    const request3 = new NextRequest(new URL('http://test.com/api/test'));
    const response = await wrappedHandler(request3);

    expect(response.status).toBe(429);
  });

  it('should use custom onRateLimited callback', async () => {
    const config = { intervalMs: 1000, maxRequests: 1 };
    const wrappedHandler = withRateLimit(testHandler, {
      config,
      onRateLimited: (retryAfter) => {
        return NextResponse.json(
          { error: 'Custom rate limit message', retryAfter },
          { status: 429 }
        );
      }
    });

    const url = 'http://test.com/api/custom-limit';

    // First request succeeds
    const request1 = new NextRequest(new URL(url));
    await wrappedHandler(request1);

    // Second request uses custom callback
    const request2 = new NextRequest(new URL(url));
    const response = await wrappedHandler(request2);

    expect(response.status).toBe(429);
    const data = (await response.json()) as { error: string; retryAfter: number };
    expect(data.error).toBe('Custom rate limit message');
    expect(data.retryAfter).toBeGreaterThan(0);
  });

  it('should add rate limit headers to response', async () => {
    const config = { intervalMs: 1000, maxRequests: 5 };
    const wrappedHandler = withRateLimit(testHandler, {
      config,
      addHeaders: true
    });

    const request = new NextRequest(new URL('http://test.com/api/test'));
    const response = await wrappedHandler(request);

    expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
    expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('should not add headers when addHeaders is false', async () => {
    const config = { intervalMs: 1000, maxRequests: 5 };
    const wrappedHandler = withRateLimit(testHandler, {
      config,
      addHeaders: false
    });

    const request = new NextRequest(new URL('http://test.com/api/test'));
    const response = await wrappedHandler(request);

    expect(response.headers.get('X-RateLimit-Limit')).toBeNull();
    expect(response.headers.get('X-RateLimit-Remaining')).toBeNull();
  });

  it('should skip rate limiting for static assets', async () => {
    const wrappedHandler = withRateLimit(testHandler);

    // Make many requests to static assets
    const paths = ['/api/test.png', '/api/test.css', '/api/test.js'];

    for (const path of paths) {
      const request = new NextRequest(new URL(`http://test.com${path}`));
      await wrappedHandler(request);
    }

    // All should succeed (rate limiting skipped)
    expect(testHandler).toHaveBeenCalledTimes(3);
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    globalRateLimiter.clear();
  });

  afterEach(() => {
    globalRateLimiter.clear();
  });

  it('should return null when under limit', () => {
    const request = new NextRequest(new URL('http://test.com/api/test'));
    const result = checkRateLimit(request, {
      config: { intervalMs: 1000, maxRequests: 5 }
    });

    expect(result).toBeNull();
  });

  it('should return error response when limit exceeded', () => {
    const config = { intervalMs: 1000, maxRequests: 2 };
    const url = 'http://test.com/api/check-limit';

    // Exhaust limit
    for (let i = 0; i < 2; i++) {
      const request = new NextRequest(new URL(url));
      checkRateLimit(request, { config });
    }

    // Next check should return error
    const request = new NextRequest(new URL(url));
    const result = checkRateLimit(request, { config });

    // In test env NextResponse is a mock class - check status instead of instanceof
    expect(result?.status).toBe(429);
  });

  it('should return null when skip is true', () => {
    const request = new NextRequest(new URL('http://test.com/api/test'));
    const result = checkRateLimit(request, { skip: true });

    expect(result).toBeNull();
  });
});

describe('getRateLimitStatus', () => {
  it('should return rate limit status info', () => {
    const request = new NextRequest(new URL('http://test.com/api/test'));
    const status = getRateLimitStatus(request);

    expect(status).toHaveProperty('limit');
    expect(status).toHaveProperty('remaining');
    expect(status).toHaveProperty('resetAt');
    expect(status).toHaveProperty('resetInSeconds');
    expect(status.resetInSeconds).toBeGreaterThan(0);
  });

  it('should use custom config when provided', () => {
    const request = new NextRequest(new URL('http://test.com/api/test'));
    const customConfig = { intervalMs: 30000, maxRequests: 50 };
    const status = getRateLimitStatus(request, customConfig);

    expect(status.limit).toBe(50);
    expect(status.resetInSeconds).toBe(30);
  });
});
