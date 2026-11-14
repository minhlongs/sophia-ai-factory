/**
 * End-to-end middleware reachability tests for signature-verified postbacks.
 *
 * Exercises the real `proxy` (`src/middleware.ts`), real CSRF check
 * (`src/seed/security/csrf.ts`), real API pipeline (`api-pipeline.ts` +
 * `api-handler.ts`), real tenant-isolation middlewares, and real public-route
 * allowlist (`src/forest/middleware/guard/public-routes.ts`) without mocking
 * `requiresCsrfCheck` or `isPublicApiRoute`.
 *
 * Proves external provider callbacks (no browser session, no CSRF cookie) pass
 * middleware to reach their per-workspace HMAC handlers, while unlisted
 * subpaths and ordinary session APIs still fail closed.
 *
 * @module middleware/__tests__/postback-reachability.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/security/rate-limiting-middleware', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    reset: Date.now() + 60_000,
  }),
  getClientIdentifier: vi.fn().mockReturnValue('provider-edge-ip'),
  RATE_LIMITS: {
    api: { maxRequests: 100, windowMs: 60_000 },
    auth: { maxRequests: 10, windowMs: 60_000 },
    webhook: { maxRequests: 1000, windowMs: 60_000 },
    discovery: { maxRequests: 50, windowMs: 60_000 },
  },
}));

vi.mock('@/forest/middleware/rate-limiter', () => ({
  checkAuthRateLimit: vi.fn().mockResolvedValue(null),
  checkAdminRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/seed/auth/better-auth-session', () => {
  class AuthSystemError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
      super(message);
      this.name = 'AuthSystemError';
    }
  }
  return {
    AuthSystemError,
    getCurrentUserFromHeaders: vi.fn().mockResolvedValue(null),
  };
});

vi.mock('@/tree/usage-metering', () => ({
  emitUsageEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/tree/signals/track', () => ({
  track: vi.fn(),
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { proxy } from '@/middleware';

function providerPost(
  pathname: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`https://sophia.agencyos.network${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ sub_id: 'link_1', amount: 100 }),
  });
}

describe('middleware postback & webhook reachability (real CSRF + public-route gates)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['/api/postback/partnerstack', { 'pstack-signature': 'hmac_hex' }],
    ['/api/postback/binance-link', { 'x-signature': 'hmac_hex' }],
    ['/api/postback/tiktok_shop', { 'x-tiktok-signature': 'hmac_hex' }],
    ['/api/webhooks/saas-crypto/binance', { authorization: 'Bearer raw_binance_hmac_hex' }],
    ['/api/webhooks/saas-crypto/partnerstack', { 'x-partnerstack-signature': 'hmac_hex' }],
    ['/api/webhooks/affiliate/tiktok_shop', { 'x-tts-signature': 'hmac_hex' }],
    ['/api/webhooks/affiliate/amazon_associates', { 'x-amz-signature': 'hmac_hex' }],
    ['/api/webhooks/accesstrade', { 'x-accesstrade-signature': 'hmac_hex' }],
    ['/api/webhooks/amazon', { 'x-amazon-signature': 'hmac_hex' }],
    ['/api/webhooks/awin', { 'x-awin-signature': 'hmac_hex' }],
    ['/api/webhooks/tiktok-shop', { 'x-tts-signature': 'hmac_hex' }],
  ])('lets unauthenticated provider POST %s pass middleware without CSRF cookie or user session', async (pathname, headers) => {
    const res = await proxy(providerPost(pathname, headers));

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Response-Time-Ms')).not.toBeNull();
    expect(getCurrentUserFromHeaders).not.toHaveBeenCalled();
  });

  it.each([
    '/api/postback/unlisted-provider',
    '/api/postback/partnerstack/extra',
    '/api/webhooks/saas-crypto/unlisted-provider',
    '/api/webhooks/affiliate/unlisted-provider',
    '/api/webhooks/unlisted-provider',
  ])('still rejects unlisted webhook/postback path %s with 401 before any handler runs', async (pathname) => {
    const res = await proxy(providerPost(pathname, { 'x-signature': 'hmac_hex' }));

    expect(res.status).toBe(401);
    expect(getCurrentUserFromHeaders).toHaveBeenCalledTimes(1);
  });

  it('still rejects ordinary authenticated API POSTs without a CSRF token with 403', async () => {
    const res = await proxy(providerPost('/api/user/settings'));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'csrf_token_invalid' });
  });
});
