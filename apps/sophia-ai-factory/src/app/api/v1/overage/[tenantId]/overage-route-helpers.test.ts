import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  validateJwt: vi.fn(),
  requireOrgMembership: vi.fn(),
  checkRateLimit: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('@/seed/security/jwt-validator', () => ({ validateJwt: mocks.validateJwt }));
vi.mock('@/seed/db/org-membership', () => ({ requireOrgMembership: mocks.requireOrgMembership }));
vi.mock('@/seed/security/rate-limiter', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: mocks.loggerWarn, error: mocks.loggerError },
}));

import { fetchTenantOverageData, verifyTenantOverageAccess } from './overage-route-helpers';

function makeRequest(agencyId?: string): NextRequest {
  const headers = new Headers({ authorization: 'Bearer signed-token' });
  if (agencyId) headers.set('x-raas-agency-id', agencyId);
  return new NextRequest('https://sophia.test/api/v1/overage/tenant-1', { headers });
}

function createLicenseQuery(result: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

function createEventsQuery(result: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}

function mockTenantDb(licenseResult: unknown, eventsResult: unknown) {
  const licenseQuery = createLicenseQuery(licenseResult);
  const eventsQuery = createEventsQuery(eventsResult);
  const from = vi.fn((table: string) => table === 'raas_licenses' ? licenseQuery : eventsQuery);
  mocks.createServerClient.mockReturnValue({ from });
  return { from, licenseQuery, eventsQuery };
}

describe('verifyTenantOverageAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateJwt.mockResolvedValue({ valid: true, payload: { sub: 'user-1', agency_id: 'tenant-1' } });
    mocks.requireOrgMembership.mockResolvedValue({ authorized: true, orgId: 'tenant-1' });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 98, resetAt: 1_700_000_000_000 });
  });

  it('returns 401 for invalid or incomplete authentication', async () => {
    mocks.validateJwt.mockResolvedValueOnce({ valid: false, error: 'expired' });
    const invalid = await verifyTenantOverageAccess(makeRequest(), 'tenant-1');
    expect(invalid.authorized).toBe(false);
    if (!invalid.authorized) expect(invalid.response.status).toBe(401);

    mocks.validateJwt.mockResolvedValueOnce({ valid: true, payload: {} });
    const missingSubject = await verifyTenantOverageAccess(makeRequest(), 'tenant-1');
    expect(missingSubject.authorized).toBe(false);
    if (!missingSubject.authorized) expect(missingSubject.response.status).toBe(401);
  });

  it('denies non-members and requests that specify a different tenant', async () => {
    mocks.requireOrgMembership.mockResolvedValueOnce({ authorized: false });
    const noMembership = await verifyTenantOverageAccess(makeRequest(), 'tenant-1');
    expect(noMembership.authorized).toBe(false);
    if (!noMembership.authorized) expect(noMembership.response.status).toBe(403);

    const crossTenant = await verifyTenantOverageAccess(makeRequest('tenant-2'), 'tenant-1');
    expect(crossTenant.authorized).toBe(false);
    if (!crossTenant.authorized) {
      expect(crossTenant.response.status).toBe(403);
      await expect(crossTenant.response.json()).resolves.toEqual({ message: 'Cross-tenant access denied' });
    }
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it('denies tenants that are not bound to both the signed JWT and organization membership', async () => {
    mocks.validateJwt.mockResolvedValueOnce({
      valid: true,
      payload: { sub: 'user-1', agency_id: 'tenant-2' },
    });
    const jwtMismatch = await verifyTenantOverageAccess(makeRequest('tenant-1'), 'tenant-1');
    expect(jwtMismatch.authorized).toBe(false);
    if (!jwtMismatch.authorized) expect(jwtMismatch.response.status).toBe(403);

    mocks.validateJwt.mockResolvedValueOnce({
      valid: true,
      payload: { sub: 'user-1', agency_id: 'tenant-1' },
    });
    mocks.requireOrgMembership.mockResolvedValueOnce({ authorized: true, orgId: 'tenant-2' });
    const membershipMismatch = await verifyTenantOverageAccess(makeRequest(), 'tenant-1');
    expect(membershipMismatch.authorized).toBe(false);
    if (!membershipMismatch.authorized) expect(membershipMismatch.response.status).toBe(403);

    mocks.validateJwt.mockResolvedValueOnce({ valid: true, payload: { sub: 'user-1' } });
    const missingTenantClaim = await verifyTenantOverageAccess(makeRequest(), 'tenant-1');
    expect(missingTenantClaim.authorized).toBe(false);
    if (!missingTenantClaim.authorized) expect(missingTenantClaim.response.status).toBe(403);

    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it('returns 429 when tenant request rate exceeds the limit', async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: 1_700_000_000_000, retryAfter: 45 });

    const result = await verifyTenantOverageAccess(makeRequest(), 'tenant-1');

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(429);
      await expect(result.response.json()).resolves.toEqual({ message: 'Rate limit exceeded', retryAfter: 45 });
    }
  });

  it('returns the authenticated user and tenant rate-limit metadata', async () => {
    await expect(verifyTenantOverageAccess(makeRequest(), 'tenant-1')).resolves.toEqual({
      authorized: true,
      userId: 'user-1',
      rateLimitResult: { remaining: 98, resetAt: 1_700_000_000_000 },
    });
  });
});

describe('fetchTenantOverageData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when the requested tenant has no active license', async () => {
    const { licenseQuery, eventsQuery } = mockTenantDb({ data: null, error: null }, { data: [], error: null });

    await expect(fetchTenantOverageData('user-1', 'tenant-1')).resolves.toEqual({
      ok: false,
      status: 404,
      message: 'Tenant not found or no active license',
    });
    expect(licenseQuery.eq).toHaveBeenCalledWith('agency_id', 'tenant-1');
    expect(licenseQuery.eq).toHaveBeenCalledWith('status', 'active');
    expect(eventsQuery.select).not.toHaveBeenCalled();
  });

  it('returns 500 when overage events cannot be read', async () => {
    mockTenantDb(
      { data: { nonce: 'nonce-1', tier: 'PREMIUM', agency_id: 'tenant-1' }, error: null },
      { data: null, error: { message: 'D1 unavailable' } },
    );

    await expect(fetchTenantOverageData('user-1', 'tenant-1')).resolves.toEqual({
      ok: false,
      status: 500,
      message: 'Failed to fetch overage events',
    });
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it('returns only the caller and license scoped overage events', async () => {
    const events = [{ id: 'event-1', amount: 10 }];
    const { eventsQuery } = mockTenantDb(
      { data: { nonce: 'nonce-1', tier: 'PREMIUM', agency_id: 'tenant-1' }, error: null },
      { data: events, error: null },
    );

    await expect(fetchTenantOverageData('user-1', 'tenant-1')).resolves.toEqual({
      ok: true,
      data: { tier: 'PREMIUM', overageEvents: events },
    });
    expect(eventsQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eventsQuery.eq).toHaveBeenCalledWith('license_nonce', 'nonce-1');
    expect(eventsQuery.limit).toHaveBeenCalledWith(100);
  });

  it('normalizes a null event list to an empty array', async () => {
    mockTenantDb(
      { data: { nonce: 'nonce-2', tier: 'BASIC', agency_id: 'tenant-1' }, error: null },
      { data: null, error: null },
    );

    await expect(fetchTenantOverageData('user-1', 'tenant-1')).resolves.toEqual({
      ok: true,
      data: { tier: 'BASIC', overageEvents: [] },
    });
  });
});
