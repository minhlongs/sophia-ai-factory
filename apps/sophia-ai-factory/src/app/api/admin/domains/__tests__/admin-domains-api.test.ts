import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { BrandDomainIdentity } from '@/seed/domain';

const requireAdminMock = vi.hoisted(() => vi.fn());
const getD1Mock = vi.hoisted(() => vi.fn());
const listBrandDomainsMock = vi.hoisted(() => vi.fn());
const listAuditMock = vi.hoisted(() => vi.fn());
const registerBrandDomainMock = vi.hoisted(() => vi.fn());
const updateChecksMock = vi.hoisted(() => vi.fn());
const transitionStatusMock = vi.hoisted(() => vi.fn());
const syncActiveMock = vi.hoisted(() => vi.fn());

vi.mock('@/seed/auth/admin', () => ({ requireAdmin: requireAdminMock }));
vi.mock('@/seed/db/client', () => ({ getD1: getD1Mock }));
vi.mock('@/tree/brand-domains', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/tree/brand-domains')>();
  return {
    ...actual,
    listBrandDomains: listBrandDomainsMock,
    listBrandDomainAuditEvents: listAuditMock,
    registerBrandDomain: registerBrandDomainMock,
    updateBrandDomainChecks: updateChecksMock,
    transitionBrandDomainStatus: transitionStatusMock,
    syncActiveBrandDomainsFromD1: syncActiveMock,
  };
});

import { GET, POST } from '@/app/api/admin/domains/route';
import { PATCH } from '@/app/api/admin/domains/[id]/route';

const ADMIN_AUTH = { user: { id: 'founder-1', email: 'founder@sophia.test' } };
const FAKE_DB = {} as D1Database;
const SAMPLE_DOMAIN: BrandDomainIdentity = {
  id: 'dom-1',
  hostname: 'app.newbrand.io',
  cloudflareZoneId: 'a'.repeat(32),
  workerName: 'sophia-ai-factory',
  tenantId: 'tenant-1',
  status: 'PENDING',
  isCanonical: false,
  authPolicy: 'standard',
  checks: {
    ownershipVerified: true,
    cfZoneEligible: true,
    workerAttached: false,
    tlsVerified: false,
    authOriginVerified: false,
    accessPolicyVerified: false,
    tenantAuthVerified: false,
    noPublicBypassVerified: false,
    externalCallbacksReviewed: false,
    smokeVerified: false,
  },
  createdBy: 'founder-1',
  activatedBy: null,
  activatedAt: null,
  suspendedAt: null,
  createdAt: '2026-11-24T00:00:00Z',
  updatedAt: '2026-11-24T00:00:00Z',
};

describe('API /api/admin/domains & /api/admin/domains/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue(ADMIN_AUTH);
    getD1Mock.mockResolvedValue(FAKE_DB);
    listBrandDomainsMock.mockResolvedValue([SAMPLE_DOMAIN]);
    listAuditMock.mockResolvedValue([]);
    registerBrandDomainMock.mockResolvedValue(SAMPLE_DOMAIN);
    updateChecksMock.mockResolvedValue(SAMPLE_DOMAIN);
    transitionStatusMock.mockResolvedValue({ ...SAMPLE_DOMAIN, status: 'ACTIVE' });
    syncActiveMock.mockResolvedValue(['app.newbrand.io']);
  });

  it('GET enforces admin auth, handles missing D1, and returns registry snapshot', async () => {
    requireAdminMock.mockResolvedValueOnce(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    const denied = await GET(new NextRequest('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/admin/domains'));
    expect(denied.status).toBe(403);

    getD1Mock.mockResolvedValueOnce(null);
    const noDb = await GET(new NextRequest('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/admin/domains'));
    expect(noDb.status).toBe(503);

    const ok = await GET(new NextRequest('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/admin/domains'));
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { domains: BrandDomainIdentity[] };
    expect(body.domains).toHaveLength(1);

    listBrandDomainsMock.mockRejectedValueOnce(new Error('D1 failure'));
    const errRes = await GET(new NextRequest('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/admin/domains'));
    expect(errRes.status).toBe(500);
  });

  it('POST validates JSON, hostname, workerName, zoneId, tenantId, authPolicy and creates domain', async () => {
    const makePost = (payload: unknown) =>
      new NextRequest('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/admin/domains', {
        method: 'POST',
        body: typeof payload === 'string' ? payload : JSON.stringify(payload),
      });

    expect((await POST(makePost('{bad-json'))).status).toBe(400);
    expect((await POST(makePost({ hostname: '' }))).status).toBe(400);
    expect((await POST(makePost({ hostname: 'app.newbrand.io', workerName: 'BAD_NAME!' }))).status).toBe(400);
    expect((await POST(makePost({ hostname: 'app.newbrand.io', cloudflareZoneId: 'short' }))).status).toBe(400);
    expect((await POST(makePost({ hostname: 'app.newbrand.io', tenantId: 'x'.repeat(130) }))).status).toBe(400);
    expect((await POST(makePost({ hostname: 'app.newbrand.io', authPolicy: 'wildcard' }))).status).toBe(400);

    getD1Mock.mockResolvedValueOnce(null);
    expect((await POST(makePost({ hostname: 'app.newbrand.io' }))).status).toBe(503);

    const created = await POST(makePost({ hostname: 'app.newbrand.io', cloudflareZoneId: 'a'.repeat(32) }));
    expect(created.status).toBe(201);

    registerBrandDomainMock.mockRejectedValueOnce(new Error('Brand domain app.newbrand.io is already registered'));
    expect((await POST(makePost({ hostname: 'app.newbrand.io' }))).status).toBe(400);

    registerBrandDomainMock.mockRejectedValueOnce(new Error('unexpected db outage'));
    expect((await POST(makePost({ hostname: 'app.newbrand.io' }))).status).toBe(500);
  });

  it('PATCH handles update_checks, lifecycle transitions, and 400/404/409/500/503 errors', async () => {
    const callPatch = (id: string, payload: unknown) =>
      PATCH(
        new NextRequest(`https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/admin/domains/${id}`, {
          method: 'PATCH',
          body: typeof payload === 'string' ? payload : JSON.stringify(payload),
        }),
        { params: Promise.resolve({ id }) },
      );

    expect((await callPatch('', { action: 'verify' })).status).toBe(400);
    expect((await callPatch('dom-1', '{bad-json')).status).toBe(400);
    expect((await callPatch('dom-1', { action: 'unknown' })).status).toBe(400);
    expect((await callPatch('dom-1', { action: 'update_checks', checks: { tlsVerified: 'yes' } })).status).toBe(400);
    expect((await callPatch('dom-1', { action: 'update_checks', checks: {} })).status).toBe(400);

    getD1Mock.mockResolvedValueOnce(null);
    expect((await callPatch('dom-1', { action: 'verify' })).status).toBe(503);

    expect((await callPatch('dom-1', { action: 'update_checks', checks: { tlsVerified: true } })).status).toBe(200);
    expect((await callPatch('dom-1', { action: 'activate' })).status).toBe(200);
    expect(syncActiveMock).toHaveBeenCalledWith({ db: FAKE_DB, force: true });

    transitionStatusMock.mockRejectedValueOnce(new Error('Brand domain not found'));
    expect((await callPatch('missing', { action: 'verify' })).status).toBe(404);

    updateChecksMock.mockRejectedValueOnce(new Error('Cannot uncheck readiness gates on ACTIVE domain'));
    expect((await callPatch('dom-1', { action: 'update_checks', checks: { tlsVerified: false } })).status).toBe(409);

    transitionStatusMock.mockRejectedValueOnce(new Error('Cannot activate: missing gates'));
    expect((await callPatch('dom-1', { action: 'activate' })).status).toBe(409);

    transitionStatusMock.mockRejectedValueOnce(new Error('unexpected failure'));
    expect((await callPatch('dom-1', { action: 'suspend' })).status).toBe(500);
  });
});
