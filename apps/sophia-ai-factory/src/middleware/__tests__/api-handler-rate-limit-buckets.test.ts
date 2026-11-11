/**
 * Rate-limit bucket assignment for /api/* paths in handleApiRoute.
 *
 * BYOK and admin routes must not share the 10/min auth bucket with /api/auth/*:
 * the Setup Wizard re-reads /api/user/byok on every step and page refresh, so a
 * shared bucket turns normal onboarding reloads into 429 responses.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/forest/middleware/tenant-isolation', () => ({
  tenantIsolationMiddleware: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/forest/middleware/agy-tenant-isolation', () => ({
  agyTenantIsolation: vi.fn().mockResolvedValue(null),
  agyTenantIsolationMiddleware: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/seed/security/rate-limiting-middleware', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    reset: Date.now() + 60_000,
  }),
  getClientIdentifier: vi.fn().mockReturnValue('test-client'),
  RATE_LIMITS: {
    api: { maxRequests: 100, windowSeconds: 60, identifier: 'api' },
    auth: { maxRequests: 10, windowSeconds: 60, identifier: 'auth' },
    admin: { maxRequests: 50, windowSeconds: 60, identifier: 'admin' },
    discovery: { maxRequests: 30, windowSeconds: 60, identifier: 'discovery' },
    webhook: { maxRequests: 1000, windowSeconds: 60, identifier: 'webhook' },
  },
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  AuthSystemError: class extends Error {},
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(),
}));

vi.mock('@/forest/middleware/auth-guard', () => ({
  isPublicApiRoute: vi.fn().mockReturnValue(false),
}));

vi.mock('@/tree/usage-metering', () => ({
  emitUsageEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/seed/security/verify-internal-secret', () => ({
  verifyInternalSecret: vi.fn().mockReturnValue(true),
}));

vi.mock('@/tree/signals/track', () => ({
  track: vi.fn(),
}));

import { checkRateLimit, RATE_LIMITS } from '@/seed/security/rate-limiting-middleware';
import { handleApiRoute } from '../api-handler';

function requestFor(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`);
}

describe('handleApiRoute rate-limit buckets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      reset: Date.now() + 60_000,
      remaining: 1,
    } as ReturnType<typeof checkRateLimit> extends Promise<infer R> ? R : never);
  });

  it('routes /api/auth/* to the auth bucket', async () => {
    await handleApiRoute(requestFor('/api/auth/get-session'), '/api/auth/get-session', Date.now());

    expect(vi.mocked(checkRateLimit).mock.calls[0]?.[1]).toBe(RATE_LIMITS.auth);
  });

  it('keeps /api/user/byok out of the auth bucket', async () => {
    await handleApiRoute(requestFor('/api/user/byok'), '/api/user/byok', Date.now());

    expect(vi.mocked(checkRateLimit).mock.calls[0]?.[1]).toBe(RATE_LIMITS.admin);
  });

  it('keeps /api/user/byok sub-routes in the admin bucket', async () => {
    await handleApiRoute(requestFor('/api/user/byok/test'), '/api/user/byok/test', Date.now());

    expect(vi.mocked(checkRateLimit).mock.calls[0]?.[1]).toBe(RATE_LIMITS.admin);
  });

  it('routes /api/admin/* to the admin bucket', async () => {
    await handleApiRoute(requestFor('/api/admin/users'), '/api/admin/users', Date.now());

    expect(vi.mocked(checkRateLimit).mock.calls[0]?.[1]).toBe(RATE_LIMITS.admin);
  });

  it('gives BYOK a much larger budget than a single auth request', async () => {
    const adminBucket = RATE_LIMITS.admin as { maxRequests: number };
    const authBucket = RATE_LIMITS.auth as { maxRequests: number };

    expect(adminBucket.maxRequests).toBeGreaterThan(authBucket.maxRequests);
  });
});
