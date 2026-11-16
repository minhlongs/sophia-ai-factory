/**
 * End-to-end middleware reachability tests for PayOS IPN and Telegram Bot webhooks.
 *
 * Exercises the real `proxy` (`src/middleware.ts`), real CSRF gate (`csrf.ts`),
 * real tenant isolation (`tenant-isolation.ts`), real API pipeline (`api-pipeline.ts`
 * + `api-handler.ts`), and real public-route allowlist (`public-routes.ts`) under
 * production-realistic `INTERNAL_API_SECRET` and `REQUIRE_AGENCY_ID=true`.
 *
 * @module middleware/__tests__/payos-telegram-webhook-reachability.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

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

vi.mock('@/tree/audit/audit-logger', () => ({
  logValidationWithReceipt: vi.fn().mockResolvedValue(undefined),
}));

import { checkRateLimit, RATE_LIMITS } from '@/seed/security/rate-limiting-middleware';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { proxy } from '@/middleware';

function externalPost(
  pathname: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`https://sophia.agencyos.network${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ ok: true }),
  });
}

describe('middleware double-gate reachability for PayOS IPN and Telegram webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('INTERNAL_API_SECRET', 'prod-internal-secret-configured');
    vi.stubEnv('REQUIRE_AGENCY_ID', 'true');
  });

  it.each([
    '/api/payos/ipn',
    '/api/webhooks/payos',
    '/api/webhooks/nowpayments',
    '/api/webhooks/telegram',
  ])('lets external POST %s pass all middleware gates under production env vars', async (pathname) => {
    const res = await proxy(
      externalPost(pathname, {
        'x-telegram-bot-api-secret-token': 'provider-secret',
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Response-Time-Ms')).not.toBeNull();
    expect(getCurrentUserFromHeaders).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith('provider-edge-ip', RATE_LIMITS.webhook);
  });

  it.each([
    '/api/payos',
    '/api/payos/create-link',
    '/api/payos/ipn/extra',
  ])('keeps sibling PayOS route %s protected by Gate 1 CSRF (403 without csrf-token)', async (pathname) => {
    const res = await proxy(externalPost(pathname));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'csrf_token_invalid' });
    expect(getCurrentUserFromHeaders).not.toHaveBeenCalled();
  });

  it('returns 503 canary_window when Cloudflare-Workers-Version-Key is non-stable and allows stable', async () => {
    const canaryRes = await proxy(
      externalPost('/api/webhooks/telegram', {
        'Cloudflare-Workers-Version-Key': 'canary-preview',
      }),
    );
    expect(canaryRes.status).toBe(503);
    expect(canaryRes.headers.get('Retry-After')).toBe('30');
    await expect(canaryRes.json()).resolves.toMatchObject({ error: 'canary_window' });

    const stableRes = await proxy(
      externalPost('/api/webhooks/telegram', {
        'Cloudflare-Workers-Version-Key': 'stable',
      }),
    );
    expect(stableRes.status).toBe(200);
  });

  it('strips spoofed x-user-id, x-user-role, and x-user-tier headers forwarded to public webhook routes', async () => {
    const nextSpy = vi.spyOn(NextResponse, 'next');
    const req = externalPost('/api/webhooks/telegram', {
      'x-user-id': 'spoofed-admin-id',
      'x-user-role': 'admin',
      'x-user-tier': 'MASTER',
    });

    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(req.headers.get('x-user-id')).toBeNull();
    expect(req.headers.get('x-user-role')).toBeNull();
    expect(req.headers.get('x-user-tier')).toBe('BASIC');

    const forwarded = (nextSpy.mock.calls.at(-1)?.[0] as { request?: { headers?: Headers } } | undefined)?.request?.headers;
    expect(forwarded).toBeInstanceOf(Headers);
    expect(forwarded?.get('x-user-id')).toBeNull();
    expect(forwarded?.get('x-user-role')).toBeNull();
    expect(forwarded?.get('x-user-tier')).toBe('BASIC');
    nextSpy.mockRestore();
  });

  it('still rejects unlisted webhook subpath /api/webhooks/telegram/extra with 403 tenant isolation when REQUIRE_AGENCY_ID=true and 401 when unset', async () => {
    const strictRes = await proxy(
      externalPost('/api/webhooks/telegram/extra', {
        'x-telegram-bot-api-secret-token': 'provider-secret',
      }),
    );

    expect(strictRes.status).toBe(403);
    await expect(strictRes.json()).resolves.toMatchObject({ code: 'MISSING_AGENCY_ID' });
    expect(getCurrentUserFromHeaders).not.toHaveBeenCalled();

    vi.stubEnv('REQUIRE_AGENCY_ID', 'false');
    const gate2Res = await proxy(
      externalPost('/api/webhooks/telegram/extra', {
        'x-telegram-bot-api-secret-token': 'provider-secret',
      }),
    );
    expect(gate2Res.status).toBe(401);
    expect(getCurrentUserFromHeaders).toHaveBeenCalledTimes(1);
    expect(checkRateLimit).toHaveBeenLastCalledWith('provider-edge-ip', RATE_LIMITS.api);
  });

  it('rejects unlisted /api/webhooks/unlisted-bot with 403 tenant isolation when REQUIRE_AGENCY_ID=true and 401 when unset', async () => {
    const strictRes = await proxy(externalPost('/api/webhooks/unlisted-bot'));
    expect(strictRes.status).toBe(403);
    expect(getCurrentUserFromHeaders).not.toHaveBeenCalled();

    vi.stubEnv('REQUIRE_AGENCY_ID', 'false');
    const gate2Res = await proxy(externalPost('/api/webhooks/unlisted-bot'));
    expect(gate2Res.status).toBe(401);
    expect(getCurrentUserFromHeaders).toHaveBeenCalledTimes(1);
  });
});
