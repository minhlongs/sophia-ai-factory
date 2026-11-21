import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CRON_ROUTES, PERMITTED_CRON_ROUTES } from '../../../scripts/inject-scheduled-handler.mjs';
import { isPublicApiRoute } from '@/forest/middleware/guard/public-routes';
import { GET as smokeOneTimeGet } from '@/app/api/cron/smoke-one-time/route';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn().mockResolvedValue(null),
  AuthSystemError: class AuthSystemError extends Error {},
}));
vi.mock('@/tree/usage-metering', () => ({ emitUsageEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/tree/signals/track', () => ({ track: vi.fn() }));
vi.mock('@/seed/security/rate-limiting-middleware', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60_000 }),
  getClientIdentifier: vi.fn().mockReturnValue('cf-cron-worker'),
  RATE_LIMITS: { api: { maxRequests: 100, windowMs: 60_000 }, auth: { maxRequests: 10, windowMs: 60_000 }, webhook: { maxRequests: 1000, windowMs: 60_000 }, discovery: { maxRequests: 50, windowMs: 60_000 } },
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { handleApiPipeline } from '../api-pipeline';
import { checkRateLimit } from '@/seed/security/rate-limiting-middleware';

const ALL_SCHEDULED_CRON_ROUTES = [...new Set(Object.values(CRON_ROUTES).flat())].sort();
const PERMITTED_ROUTES = ['/api/cron/d1-backup'];
const POLICY_DISABLED_ROUTES = ALL_SCHEDULED_CRON_ROUTES.filter((route) => !PERMITTED_ROUTES.includes(route) && route !== '/api/cron/email-drip');

describe('cron middleware reachability (CRON_ROUTES <-> public-routes)', () => {
  const TEST_CRON_SECRET = 'synthetic-cron-secret-for-reachability-test';
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', TEST_CRON_SECRET); });
  afterEach(() => { vi.unstubAllEnvs(); });
  it('separates scheduled permissions from legacy HTTP exemptions', () => {
    expect(ALL_SCHEDULED_CRON_ROUTES).toHaveLength(40);
    expect(PERMITTED_CRON_ROUTES).toEqual(PERMITTED_ROUTES);
    expect(isPublicApiRoute('/api/cron/d1-backup')).toBe(true);
    expect(isPublicApiRoute('/api/cron/email-drip')).toBe(true);
    expect(isPublicApiRoute('/api/cron/error-digest')).toBe(false);
  });
  it('keeps all other scheduled routes out of the middleware session exemption', () => {
    expect(POLICY_DISABLED_ROUTES).toHaveLength(38);
    for (const route of POLICY_DISABLED_ROUTES) expect(isPublicApiRoute(route)).toBe(false);
  });
  it.each(POLICY_DISABLED_ROUTES)('requires a session for direct requests to %s even with a cron credential', async (pathname) => {
    const req = new NextRequest(`https://worker.invalid${pathname}`, { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } });
    const res = await handleApiPipeline(req, pathname, 'vi', Date.now(), new Headers(req.headers), 'nonce-cron', false);
    expect(res?.status).toBe(401);
  });
  it('keeps unlisted and path variants private', () => {
    for (const pathname of ['/api/cron/unlisted-route', '/api/cron/workflow-stepper/extra', '/api/cron/', '/api/cron/d1-backup/extra', '/api/cron/d1-backup/']) expect(isPublicApiRoute(pathname)).toBe(false);
  });
  it.each(['GET', 'POST'])('preserves the permitted backup sessionless %s HTTP path', async (method) => {
    const req = new NextRequest('https://worker.invalid/api/cron/d1-backup', { method, headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } });
    const res = await handleApiPipeline(req, '/api/cron/d1-backup', 'vi', Date.now(), new Headers(req.headers), 'nonce-cron', false);
    expect(res?.status).toBe(200);
    expect(getCurrentUserFromHeaders).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalled();
  });
  it('preserves the email-drip HTTP exemption and rate limiting', async () => {
    const pathname = '/api/cron/email-drip';
    const req = new NextRequest(`https://worker.invalid${pathname}`, { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } });
    expect((await handleApiPipeline(req, pathname, 'vi', Date.now(), new Headers(req.headers), 'nonce-cron', false))?.status).toBe(200);
    expect(checkRateLimit).toHaveBeenCalled();
  });
  it('rejects invalid auth on the permitted backup endpoint', async () => {
    const req = new NextRequest('https://worker.invalid/api/cron/d1-backup', { headers: { authorization: 'Bearer wrong-secret' } });
    const res = await handleApiPipeline(req, '/api/cron/d1-backup', 'vi', Date.now(), new Headers(req.headers), 'nonce-cron', false);
    expect(res?.status).toBe(403);
  });
  it('returns the disabled result only after valid cron authentication', async () => {
    vi.stubEnv('SYNTHETIC_ENABLED', 'false');
    const url = 'https://worker.invalid/api/cron/smoke-one-time';
    expect((await smokeOneTimeGet(new NextRequest(url))).status).toBe(401);
    const response = await smokeOneTimeGet(new NextRequest(url, { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, skipped: 'disabled' });
  });
});
