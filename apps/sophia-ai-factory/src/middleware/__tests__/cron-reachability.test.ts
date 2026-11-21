import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CRON_ROUTES, PERMITTED_CRON_ROUTES } from '../../../scripts/inject-scheduled-handler.mjs';
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
const LEGACY_HTTP_ROUTES = new Set(['/api/cron/d1-backup', '/api/cron/email-drip']);
const POLICY_DISABLED_ROUTES = ALL_SCHEDULED_CRON_ROUTES.filter(
  (route) => !LEGACY_HTTP_ROUTES.has(route),
);

describe('cron middleware reachability (CRON_ROUTES <-> public-routes)', () => {
  const TEST_CRON_SECRET = 'synthetic-cron-secret-for-reachability-test';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', TEST_CRON_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exempts only the scheduled routes preserved from production', () => {
    expect(ALL_SCHEDULED_CRON_ROUTES.length).toBe(40);
    expect(PERMITTED_CRON_ROUTES).toEqual([]);
    const missing = [...LEGACY_HTTP_ROUTES].filter((route) => !isPublicApiRoute(route));
    expect(missing).toEqual([]);
  });

  it('keeps policy-disabled routes out of the middleware session exemption', () => {
    for (const route of POLICY_DISABLED_ROUTES) {
      expect(isPublicApiRoute(route)).toBe(false);
    }
    expect(LEGACY_HTTP_ROUTES.size).toBe(ALL_SCHEDULED_CRON_ROUTES.length - POLICY_DISABLED_ROUTES.length);
  });

  it.each(POLICY_DISABLED_ROUTES)('still requires a session for direct requests to %s even with a cron credential', async (pathname) => {
    const req = new NextRequest(`https://worker.invalid${pathname}`, {
      headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const res = await handleApiPipeline(req, pathname, 'vi', Date.now(), new Headers(req.headers), 'nonce-cron', false);
    expect(res?.status).toBe(401);
  });

  it('keeps unlisted /api/cron/* paths default-deny in isPublicApiRoute', () => {
    expect(isPublicApiRoute('/api/cron/unlisted-route')).toBe(false);
    expect(isPublicApiRoute('/api/cron/workflow-stepper/extra')).toBe(false);
    expect(isPublicApiRoute('/api/cron/')).toBe(false);
  });

  it.each([...LEGACY_HTTP_ROUTES])('allows %s with valid CRON_SECRET bearer token and no browser session', async (pathname) => {
    const req = new NextRequest(`https://worker.invalid${pathname}`, {
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
    const reqMissing = new NextRequest('https://worker.invalid/api/cron/workflow-stepper', {
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

    const reqWrong = new NextRequest('https://worker.invalid/api/cron/workflow-stepper', {
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

  it('returns the disabled result only after valid cron authentication', async () => {
    vi.stubEnv('SYNTHETIC_ENABLED', 'false');
    const req = new NextRequest('https://worker.invalid/api/cron/smoke-one-time', {
      headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const res = await smokeOneTimeGet(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: 'disabled' });
  });

  it('rejects unauthenticated smoke-one-time requests with 401 even when SYNTHETIC_ENABLED is disabled', async () => {
    vi.stubEnv('SYNTHETIC_ENABLED', 'false');
    const req = new NextRequest('https://worker.invalid/api/cron/smoke-one-time', {
      method: 'GET',
    });
    const res = await smokeOneTimeGet(req);
    expect(res.status).toBe(401);
  });
});
