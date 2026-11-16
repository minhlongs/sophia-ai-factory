/**
 * End-to-end middleware reachability tests for the Inngest callback endpoint.
 *
 * Exercises the real `proxy` (`src/middleware.ts`), real CSRF gate (`csrf.ts`),
 * real tenant isolation (`tenant-isolation.ts`), real API pipeline (`api-pipeline.ts`
 * + `api-handler.ts`), and real public-route allowlist (`public-routes.ts`) under
 * production-realistic `INTERNAL_API_SECRET` and `REQUIRE_AGENCY_ID=true`.
 *
 * @module middleware/__tests__/inngest-webhook-reachability.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/security/rate-limiting-middleware', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    reset: Date.now() + 60_000,
  }),
  getClientIdentifier: vi.fn().mockReturnValue('inngest-cloud-ip'),
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

function inngestRequest(
  method: 'GET' | 'POST' | 'PUT',
  pathname = '/api/inngest',
  headers: Record<string, string> = {},
): NextRequest {
  const hasBody = method !== 'GET';
  return new NextRequest(`https://sophia.agencyos.network${pathname}`, {
    method,
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      'x-inngest-signature': 't=1700000000&s=deadbeef',
      ...headers,
    },
    body: hasBody ? JSON.stringify({ event: 'inngest/function.invoked' }) : undefined,
  });
}

describe('middleware double-gate reachability for /api/inngest callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('INTERNAL_API_SECRET', 'prod-internal-secret-configured');
    vi.stubEnv('REQUIRE_AGENCY_ID', 'true');
  });

  it.each(['GET', 'POST', 'PUT'] as const)(
    'lets external %s /api/inngest pass all middleware gates under production env vars',
    async (method) => {
      const res = await proxy(inngestRequest(method));

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Response-Time-Ms')).not.toBeNull();
      expect(getCurrentUserFromHeaders).not.toHaveBeenCalled();
      expect(checkRateLimit).toHaveBeenCalledWith('inngest-cloud-ip', RATE_LIMITS.webhook);
    },
  );

  it('pins /api/inngest to stable version when Cloudflare-Workers-Version-Key is non-stable', async () => {
    const canaryRes = await proxy(
      inngestRequest('POST', '/api/inngest', {
        'Cloudflare-Workers-Version-Key': 'canary-preview',
      }),
    );
    expect(canaryRes.status).toBe(503);
    expect(canaryRes.headers.get('Retry-After')).toBe('30');
    await expect(canaryRes.json()).resolves.toMatchObject({ error: 'canary_window' });

    const stableRes = await proxy(
      inngestRequest('POST', '/api/inngest', {
        'Cloudflare-Workers-Version-Key': 'stable',
      }),
    );
    expect(stableRes.status).toBe(200);
  });

  it.each(['/api/inngest/extra', '/api/inngest-admin'])(
    'keeps %s fail-closed across CSRF, tenant isolation, and session auth',
    async (pathname) => {
      const csrfRes = await proxy(inngestRequest('POST', pathname));
      expect(csrfRes.status).toBe(403);
      await expect(csrfRes.json()).resolves.toEqual({ error: 'csrf_token_invalid' });
      expect(getCurrentUserFromHeaders).not.toHaveBeenCalled();

      const tenantRes = await proxy(inngestRequest('GET', pathname));
      expect(tenantRes.status).toBe(403);
      await expect(tenantRes.json()).resolves.toMatchObject({ code: 'MISSING_AGENCY_ID' });

      vi.stubEnv('REQUIRE_AGENCY_ID', 'false');
      const authRes = await proxy(inngestRequest('GET', pathname));
      expect(authRes.status).toBe(401);
      expect(getCurrentUserFromHeaders).toHaveBeenCalledTimes(1);
      vi.stubEnv('REQUIRE_AGENCY_ID', 'true');
    },
  );
});
