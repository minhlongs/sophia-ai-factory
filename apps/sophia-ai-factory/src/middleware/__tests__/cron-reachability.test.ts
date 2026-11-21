/**
 * Middleware reachability regression tests for scheduled /api/cron/* routes.
 *
 * Ensures every route registered in scripts/inject-scheduled-handler.mjs
 * (CRON_ROUTES) is pinned in isPublicApiRoute() so Worker scheduled()
 * dispatches with a valid CRON_SECRET bearer token pass middleware to their
 * per-route verifyCronAuth() check instead of failing with HTTP 401 from
 * Better Auth session guards. Unlisted /api/cron/* subpaths must remain
 * default-deny, and requests without a valid cron secret must still return 403.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CRON_ROUTES } from '../../../scripts/inject-scheduled-handler.mjs';
import { isPublicApiRoute } from '@/forest/middleware/guard/public-routes';
import { GET as smokeOneTimeGet } from '@/app/api/cron/smoke-one-time/route';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn().mockResolvedValue(null),
  AuthSystemError: class AuthSystemError extends Error {},
}));

vi.mock('@/tree/usage-metering', () => ({
  emitUsageEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/tree/signals/track', () => ({
  track: vi.fn(),
}));

vi.mock('@/seed/security/rate-limiting-middleware', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    reset: Date.now() + 60_000,
  }),
  getClientIdentifier: vi.fn().mockReturnValue('cf-cron-worker'),
  RATE_LIMITS: {
    api: { maxRequests: 100, windowMs: 60_000 },
    auth: { maxRequests: 10, windowMs: 60_000 },
    webhook: { maxRequests: 1000, windowMs: 60_000 },
    discovery: { maxRequests: 50, windowMs: 60_000 },
  },
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { handleApiPipeline } from '../api-pipeline';

const ALL_SCHEDULED_CRON_ROUTES = [...new Set(Object.values(CRON_ROUTES).flat())].sort();

describe('cron middleware reachability (CRON_ROUTES <-> public-routes)', () => {
  const TEST_CRON_SECRET = 'synthetic-cron-secret-for-reachability-test';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', TEST_CRON_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('pins every route in inject-scheduled-handler CRON_ROUTES in isPublicApiRoute', () => {
    expect(ALL_SCHEDULED_CRON_ROUTES.length).toBeGreaterThanOrEqual(40);
    const missing = ALL_SCHEDULED_CRON_ROUTES.filter((route) => !isPublicApiRoute(route));
    expect(missing).toEqual([]);
  });

  it('keeps unlisted /api/cron/* paths default-deny in isPublicApiRoute', () => {
    expect(isPublicApiRoute('/api/cron/unlisted-route')).toBe(false);
    expect(isPublicApiRoute('/api/cron/workflow-stepper/extra')).toBe(false);
    expect(isPublicApiRoute('/api/cron/')).toBe(false);
  });

  it.each(ALL_SCHEDULED_CRON_ROUTES)('allows %s with valid CRON_SECRET bearer token and no browser session', async (pathname) => {
    const req = new NextRequest(`https://sophia.agencyos.network${pathname}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${TEST_CRON_SECRET}`,
      },
    });
    const requestHeaders = new Headers(req.headers);

    const res = await handleApiPipeline(req, pathname, 'vi', Date.now(), requestHeaders, 'nonce-cron', false);
    expect(res?.status).toBe(200);
    expect(res?.headers.has('X-Response-Time-Ms')).toBe(true);
    expect(getCurrentUserFromHeaders).not.toHaveBeenCalled();
  });

  it('rejects /api/cron/workflow-stepper with 403 when CRON_SECRET bearer token is missing or invalid', async () => {
    const reqMissing = new NextRequest('https://sophia.agencyos.network/api/cron/workflow-stepper', {
      method: 'GET',
    });
    const resMissing = await handleApiPipeline(
      reqMissing,
      '/api/cron/workflow-stepper',
      'vi',
      Date.now(),
      new Headers(),
      'nonce-cron',
      false,
    );
    expect(resMissing?.status).toBe(403);

    const reqWrong = new NextRequest('https://sophia.agencyos.network/api/cron/workflow-stepper', {
      method: 'GET',
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const resWrong = await handleApiPipeline(
      reqWrong,
      '/api/cron/workflow-stepper',
      'vi',
      Date.now(),
      new Headers(),
      'nonce-cron',
      false,
    );
    expect(resWrong?.status).toBe(403);
  });

  it('rejects unauthenticated smoke-one-time requests with 401 even when SYNTHETIC_ENABLED is disabled', async () => {
    vi.stubEnv('SYNTHETIC_ENABLED', 'false');
    const req = new NextRequest('https://sophia.agencyos.network/api/cron/smoke-one-time', {
      method: 'GET',
    });
    const res = await smokeOneTimeGet(req);
    expect(res.status).toBe(401);
  });
});
