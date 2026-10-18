import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  validateJwt: vi.fn(),
  requireOrgMembership: vi.fn(),
  checkRateLimit: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@/seed/security/jwt-validator', () => ({ validateJwt: mocks.validateJwt }));
vi.mock('@/seed/db/org-membership', () => ({ requireOrgMembership: mocks.requireOrgMembership }));
vi.mock('@/seed/security/rate-limiter', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: { warn: mocks.loggerWarn } }));

import { authorizeQuotaRequest } from './quota-request-guard';

function makeRequest(agencyId?: string): NextRequest {
  const headers = new Headers({ authorization: 'Bearer signed-token' });
  if (agencyId) headers.set('x-raas-agency-id', agencyId);
  return new NextRequest('https://sophia.test/api/v1/quota/tenant-1', { headers });
}

describe('authorizeQuotaRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateJwt.mockResolvedValue({ valid: true, payload: { sub: 'user-1' } });
    mocks.requireOrgMembership.mockResolvedValue({ authorized: true, orgId: 'tenant-1' });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 1_700_000_000_000 });
  });

  it('rejects an invalid JWT with 401', async () => {
    mocks.validateJwt.mockResolvedValueOnce({ valid: false, error: 'expired' });

    const result = await authorizeQuotaRequest(makeRequest(), 'tenant-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(mocks.requireOrgMembership).not.toHaveBeenCalled();
  });

  it('rejects a valid JWT without a subject', async () => {
    mocks.validateJwt.mockResolvedValueOnce({ valid: true, payload: {} });

    const result = await authorizeQuotaRequest(makeRequest(), 'tenant-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it('rejects authenticated users without an organization membership', async () => {
    mocks.requireOrgMembership.mockResolvedValueOnce({ authorized: false });

    const result = await authorizeQuotaRequest(makeRequest(), 'tenant-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it('denies a request whose agency header names another tenant', async () => {
    const result = await authorizeQuotaRequest(makeRequest('tenant-2'), 'tenant-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({ message: 'Cross-tenant access denied' });
    }
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it('returns retry metadata when the tenant rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: 1_700_000_000_000,
      retryAfter: 60,
    });

    const result = await authorizeQuotaRequest(makeRequest(), 'tenant-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(result.response.headers.get('X-RateLimit-Reset')).toBe(new Date(1_700_000_000_000).toISOString());
      await expect(result.response.json()).resolves.toEqual({ message: 'Rate limit exceeded', retryAfter: 60 });
    }
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('tenant-1', 100);
  });

  it('returns an authenticated tenant context on success', async () => {
    const result = await authorizeQuotaRequest(makeRequest(), 'tenant-1');

    expect(result).toEqual({
      ok: true,
      context: {
        userId: 'user-1',
        rateLimitRemaining: 99,
        rateLimitResetAt: 1_700_000_000_000,
      },
    });
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('tenant-1', 100);
  });
});
