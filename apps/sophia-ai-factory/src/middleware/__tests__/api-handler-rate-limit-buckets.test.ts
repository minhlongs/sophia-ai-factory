/**
 * Rate-limit bucket assignment and 429 telemetry for /api/* paths in handleApiRoute.
 *
 * BYOK & Setup Wizard routes receive a dedicated `byok` bucket (40/min) — isolated
 * from both `/api/auth/*` (10/min) and `/api/admin/*` (50/min) — so normal Setup
 * Wizard reloads never starve authentication or admin consoles while capping
 * IP-level provider probing below the general `/api/*` baseline (100/min).
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

vi.mock('@/seed/security/rate-limiting-middleware', async () => {
  const actual = await vi.importActual<typeof import('@/seed/security/sql-rate-limiter-queries')>(
    '@/seed/security/sql-rate-limiter-queries',
  );
  return {
    checkRateLimit: vi.fn().mockResolvedValue({
      success: true,
      reset: Date.now() + 60_000,
    }),
    getClientIdentifier: vi.fn().mockReturnValue('ip:203.0.113.7'),
    RATE_LIMITS: actual.RATE_LIMITS,
  };
});

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
import { track } from '@/tree/signals/track';
import { D1Events } from '@/forest/telemetry/d1-event-types';
import { ApiRateLimitHitSchema } from '@/tree/signals/events/schemas-business';
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
    });
  });

  it('routes /api/auth/* to the auth bucket', async () => {
    await handleApiRoute(requestFor('/api/auth/get-session'), '/api/auth/get-session', Date.now());

    expect(vi.mocked(checkRateLimit).mock.calls[0]?.[1]).toBe(RATE_LIMITS.auth);
  });

  it('routes /api/user/byok to a dedicated byok bucket distinct from auth and admin', async () => {
    await handleApiRoute(requestFor('/api/user/byok'), '/api/user/byok', Date.now());

    const bucket = vi.mocked(checkRateLimit).mock.calls[0]?.[1];
    expect(bucket).toBe(RATE_LIMITS.byok);
    expect(bucket).not.toBe(RATE_LIMITS.auth);
    expect(bucket).not.toBe(RATE_LIMITS.admin);
  });

  it('routes /api/user/byok/test, /api/setup-wizard/*, and /api/setup/verify to the dedicated byok bucket', async () => {
    await handleApiRoute(requestFor('/api/user/byok/test'), '/api/user/byok/test', Date.now());
    await handleApiRoute(
      requestFor('/api/setup-wizard/validate-key'),
      '/api/setup-wizard/validate-key',
      Date.now(),
    );
    await handleApiRoute(requestFor('/api/setup/verify'), '/api/setup/verify', Date.now());

    expect(vi.mocked(checkRateLimit).mock.calls[0]?.[1]).toBe(RATE_LIMITS.byok);
    expect(vi.mocked(checkRateLimit).mock.calls[1]?.[1]).toBe(RATE_LIMITS.byok);
    expect(vi.mocked(checkRateLimit).mock.calls[2]?.[1]).toBe(RATE_LIMITS.byok);
  });

  it('routes /api/admin/* to the admin bucket', async () => {
    await handleApiRoute(requestFor('/api/admin/users'), '/api/admin/users', Date.now());

    expect(vi.mocked(checkRateLimit).mock.calls[0]?.[1]).toBe(RATE_LIMITS.admin);
  });

  it('sizes RATE_LIMITS.byok strictly between auth (10/min) and api (100/min)', () => {
    expect(RATE_LIMITS.byok.identifier).toBe('byok');
    expect(RATE_LIMITS.byok.maxRequests).toBeGreaterThan(RATE_LIMITS.auth.maxRequests);
    expect(RATE_LIMITS.byok.maxRequests).toBeLessThan(RATE_LIMITS.api.maxRequests);
  });

  it('returns 429 with standard headers and schema-valid byok telemetry when breached', async () => {
    const resetAt = Date.now() + 45_000;
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: resetAt,
    });

    const res = await handleApiRoute(
      requestFor('/api/user/byok'),
      '/api/user/byok',
      Date.now(),
    );

    expect(res?.status).toBe(429);
    expect(res?.headers.get('X-RateLimit-Limit')).toBe(String(RATE_LIMITS.byok.maxRequests));
    expect(res?.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res?.headers.get('X-RateLimit-Reset')).toBe(String(resetAt));
    expect(Number(res?.headers.get('Retry-After'))).toBeGreaterThan(0);

    expect(track).toHaveBeenCalledWith(
      D1Events.API_RATE_LIMIT_HIT,
      'ip:203.0.113.7',
      expect.objectContaining({ path: '/api/user/byok', limit_type: 'byok' }),
    );
    const payload = vi.mocked(track).mock.calls[0]?.[2];
    expect(ApiRateLimitHitSchema.safeParse(payload).success).toBe(true);
  });
});
