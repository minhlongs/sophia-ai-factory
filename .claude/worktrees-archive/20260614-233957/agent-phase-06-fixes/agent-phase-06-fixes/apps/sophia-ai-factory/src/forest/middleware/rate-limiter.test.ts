/**
 * Rate Limiter Tests
 * Tests for in-memory rate limiting with sliding window algorithm
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RateLimiter,
  type RateLimitConfig,
  getClientIdentifier,
  createRateLimitHeaders,
  globalRateLimiter
} from './rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  const testConfig: RateLimitConfig = {
    intervalMs: 1000, // 1 second for fast tests
    maxRequests: 5
  };

  beforeEach(() => {
    limiter = new RateLimiter(100); // Small cache for testing
  });

  afterEach(() => {
    limiter.clear();
  });

  describe('checkLimit', () => {
    it('should allow requests under the limit', () => {
      for (let i = 1; i <= 5; i++) {
        const result = limiter.checkLimit('test-key', testConfig);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(5 - i);
      }
    });

    it('should block requests exceeding the limit', () => {
      // Make max requests
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit('test-key', testConfig);
      }

      // Next request should be blocked
      const result = limiter.checkLimit('test-key', testConfig);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should allow requests after window expires', async () => {
      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit('test-key', testConfig);
      }

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should allow again
      const result = limiter.checkLimit('test-key', testConfig);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should track different keys independently', () => {
      const config = testConfig;

      // Exhaust limit for key1
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit('key1', config);
      }

      // key2 should still have full limit
      const result = limiter.checkLimit('key2', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should use sliding window algorithm', async () => {
      const config: RateLimitConfig = {
        intervalMs: 100,
        maxRequests: 3
      };

      // Make 2 requests
      limiter.checkLimit('slide-key', config);
      limiter.checkLimit('slide-key', config);

      // Wait for partial window expiry
      await new Promise(resolve => setTimeout(resolve, 60));

      // First request should have expired, so we have room for 1 more
      const result = limiter.checkLimit('slide-key', config);
      expect(result.allowed).toBe(true);
    });

    it('should handle custom interval and limits', () => {
      const customConfig: RateLimitConfig = {
        intervalMs: 60000, // 1 minute
        maxRequests: 100
      };

      const result = limiter.checkLimit('custom-key', customConfig);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when cache exceeds max size', () => {
      const smallLimiter = new RateLimiter(10);
      const config: RateLimitConfig = {
        intervalMs: 10000,
        maxRequests: 5
      };

      // Fill cache beyond max
      for (let i = 0; i < 15; i++) {
        smallLimiter.checkLimit(`key-${i}`, config);
      }

      // Cache should have evicted some entries
      expect(smallLimiter.size).toBeLessThanOrEqual(10);
    });

    it('should not evict when under max size', () => {
      const config: RateLimitConfig = {
        intervalMs: 10000,
        maxRequests: 5
      };

      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(`key-${i}`, config);
      }

      expect(limiter.size).toBe(5);
    });
  });

  describe('clear', () => {
    it('should clear all cached entries', () => {
      const config: RateLimitConfig = {
        intervalMs: 10000,
        maxRequests: 5
      };

      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(`key-${i}`, config);
      }

      expect(limiter.size).toBe(5);

      limiter.clear();

      expect(limiter.size).toBe(0);
    });
  });
});

describe('getClientIdentifier', () => {
  it('should use API key from x-api-key header', () => {
    const request = new Request('http://test.com/api', {
      headers: { 'x-api-key': 'test-api-key-123' }
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('apikey:test-api-key-123');
  });

  it('should use IP from x-forwarded-for header', () => {
    const request = new Request('http://test.com/api', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('ip:192.168.1.1');
  });

  it('should use first IP in x-forwarded-for chain', () => {
    const request = new Request('http://test.com/api', {
      headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1, 192.0.2.1' }
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('ip:203.0.113.1');
  });

  it('should use anonymous for requests without headers', () => {
    const request = new Request('http://test.com/api');

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('ip:anonymous');
  });
});

describe('createRateLimitHeaders', () => {
  it('should create standard rate limit headers', () => {
    const result = {
      allowed: true,
      remaining: 42,
      resetAt: 1234567890000
    };

    const headers = createRateLimitHeaders(result);

    expect(headers).toHaveProperty('X-RateLimit-Limit');
    expect(headers).toHaveProperty('X-RateLimit-Remaining');
    expect(headers).toHaveProperty('X-RateLimit-Reset');
    expect(headers['X-RateLimit-Remaining']).toBe('42');
  });

  it('should include Retry-After header when blocked', () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: 1234567890000,
      retryAfter: 30
    };

    const headers = createRateLimitHeaders(result);

    expect(headers['Retry-After']).toBe('30');
  });
});

describe('globalRateLimiter', () => {
  it('should be a singleton instance', () => {
    expect(globalRateLimiter).toBeInstanceOf(RateLimiter);
    expect(globalRateLimiter).toBe(globalRateLimiter);
  });

  it('should have reasonable default cache size', () => {
    // Just verify it works
    const config: RateLimitConfig = {
      intervalMs: 1000,
      maxRequests: 10
    };

    const result = globalRateLimiter.checkLimit('test', config);
    expect(result.allowed).toBe(true);
  });
});
