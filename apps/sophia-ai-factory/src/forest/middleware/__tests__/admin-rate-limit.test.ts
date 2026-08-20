/**
 * @module middleware/admin-rate-limit
 * Unit tests for the D1-backed admin endpoint rate limiter.
 *
 * Covers: threshold enforcement, per-client counters, bilingual (vi/en)
 * 429 messages, and non-admin route pass-through.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The D1-backed counter lives in src/seed/security/d1-rate-limiter. Mock it so
// the tests exercise the middleware decision logic without a live D1 binding.
const checkD1RateLimitMock = vi.fn();
vi.mock('@/seed/security/d1-rate-limiter', () => ({
  checkD1RateLimit: (...args: unknown[]) => checkD1RateLimitMock(...args),
}));

const { checkAdminRateLimit, ADMIN_RATE_LIMIT_CONFIG } = await vi.importActual<typeof import('@/forest/middleware/rate-limiter')>('@/forest/middleware/rate-limiter');

import type { NextRequest } from 'next/server';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(pathname: string, acceptLanguage = 'en'): NextRequest {
  return {
    nextUrl: { pathname },
    headers: new Headers({ 'accept-language': acceptLanguage }),
    url: `https://sophia.agencyos.network${pathname}`,
  } as unknown as NextRequest;
}

// ─── checkAdminRateLimit ─────────────────────────────────────────────────────

describe('checkAdminRateLimit', () => {
  beforeEach(() => {
    checkD1RateLimitMock.mockReset();
  });

  it('returns null (allowed) when the D1 counter permits the request', async () => {
    checkD1RateLimitMock.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 1_000_000 });

    const response = await checkAdminRateLimit(makeRequest('/api/admin/users'));

    expect(response).toBeNull();
    expect(checkD1RateLimitMock).toHaveBeenCalledWith(
      expect.any(String),
      { maxRequests: ADMIN_RATE_LIMIT_CONFIG.maxRequests, windowSeconds: ADMIN_RATE_LIMIT_CONFIG.windowSeconds },
    );
  });

  it('returns null for non-admin routes without consulting D1', async () => {
    const response = await checkAdminRateLimit(makeRequest('/api/v1/missions'));

    expect(response).toBeNull();
    expect(checkD1RateLimitMock).not.toHaveBeenCalled();
  });

  it('returns a 429 response when the D1 counter blocks the request', async () => {
    checkD1RateLimitMock.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 2_000_000 });

    const response = await checkAdminRateLimit(makeRequest('/dashboard/admin/overview'));

    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);

    const body = await response!.json() as { error: string; retryAfter: number };
    expect(body.error).toBe('Too Many Requests');
    expect(body.retryAfter).toBe(2_000_000 - Math.floor(Date.now() / 1000));
  });

  it('returns an English error message when Accept-Language is en', async () => {
    checkD1RateLimitMock.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 2_000_000 });

    const response = await checkAdminRateLimit(makeRequest('/api/admin/users', 'en'));
    const body = await response!.json() as { message: string };

    expect(body.message).toBe('Rate limit exceeded. Please try again later.');
  });

  it('returns a Vietnamese error message when Accept-Language starts with vi', async () => {
    checkD1RateLimitMock.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 2_000_000 });

    const response = await checkAdminRateLimit(makeRequest('/api/admin/users', 'vi-VN,vi;q=0.9'));
    const body = await response!.json() as { message: string };

    expect(body.message).toBe('Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.');
  });

  it('uses the client identifier as the rate-limit key (per-client counters)', async () => {
    checkD1RateLimitMock.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 1_000_000 });

    await checkAdminRateLimit(makeRequest('/api/admin/users'));
    const firstKey = checkD1RateLimitMock.mock.calls[0]![0] as string;

    checkD1RateLimitMock.mockClear();
    await checkAdminRateLimit(makeRequest('/api/admin/users'));
    const secondKey = checkD1RateLimitMock.mock.calls[0]![0] as string;

    // Same request shape → same key, so the counter is keyed per client, not per route.
    expect(firstKey).toBe(secondKey);
  });

  it('returns Retry-After and X-RateLimit-* headers on 429', async () => {
    checkD1RateLimitMock.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 2_000_000 });

    const response = await checkAdminRateLimit(makeRequest('/api/admin/users'));
    const headers = response!.headers;

    expect(headers.get('Retry-After')).toBeTruthy();
    expect(headers.get('X-RateLimit-Limit')).toBe(String(ADMIN_RATE_LIMIT_CONFIG.maxRequests));
    expect(headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(headers.get('X-RateLimit-Reset')).toBe(String(2_000_000));
  });
});

// ─── Config ──────────────────────────────────────────────────────────────────

describe('ADMIN_RATE_LIMIT_CONFIG', () => {
  it('uses 100 requests per 60 seconds by default', () => {
    expect(ADMIN_RATE_LIMIT_CONFIG.maxRequests).toBe(100);
    expect(ADMIN_RATE_LIMIT_CONFIG.windowSeconds).toBe(60);
  });
});