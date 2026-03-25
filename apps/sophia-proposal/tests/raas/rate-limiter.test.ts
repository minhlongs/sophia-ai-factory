import { describe, it, expect } from 'vitest';
import { checkRateLimit, rateLimitHeaders } from '@/lib/raas/rate-limiter';

describe('Rate Limiter', () => {
  it('allows requests within limit', () => {
    const key = `test-allow-${Date.now()}`;
    const result = checkRateLimit(key, 10);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.remaining).toBeLessThan(10);
  });

  it('blocks requests over limit', () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5);
    }
    const result = checkRateLimit(key, 5);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('generates correct rate limit headers', () => {
    const result = { allowed: true, limit: 100, remaining: 95, resetMs: 30000 };
    const headers = rateLimitHeaders(result);
    expect(headers['X-RateLimit-Limit']).toBe('100');
    expect(headers['X-RateLimit-Remaining']).toBe('95');
    expect(headers['X-RateLimit-Reset']).toBe('30');
  });

  it('handles different keys independently', () => {
    const keyA = `test-a-${Date.now()}`;
    const keyB = `test-b-${Date.now()}`;

    for (let i = 0; i < 3; i++) checkRateLimit(keyA, 3);

    const resultA = checkRateLimit(keyA, 3);
    const resultB = checkRateLimit(keyB, 3);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });
});
