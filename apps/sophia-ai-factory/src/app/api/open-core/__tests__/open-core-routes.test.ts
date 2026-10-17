/**
 * Unit & integration tests for /api/open-core/status and /api/open-core/portability
 *
 * @module app/api/open-core/__tests__/open-core-routes.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetCurrentUser = vi.fn();
const mockGetUserTier = vi.fn();
const mockResolveOrgId = vi.fn();
const mockLoadUserPortableConfig = vi.fn();
const mockSaveUserPortableConfig = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: (...args: unknown[]) => mockGetUserTier(...args),
}));

vi.mock('@/seed/auth/org-resolver/org-resolver-service', () => ({
  resolveOrgId: (...args: unknown[]) => mockResolveOrgId(...args),
}));

vi.mock('@/tree/open-core/workspace-portability-store', () => ({
  loadUserPortableConfig: (...args: unknown[]) => mockLoadUserPortableConfig(...args),
  saveUserPortableConfig: (...args: unknown[]) => mockSaveUserPortableConfig(...args),
}));

import { GET as getStatus, POST as postStatus } from '../status/route';
import { GET as getPortability, POST as postPortability } from '../portability/route';
import { issueRaasLicenseToken } from '@/seed/security/raas-license-verifier';

const TEST_LICENSE_SECRET = 'sophia-raas-license-route-secret-2026';

describe('/api/open-core/status route', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.SOPHIA_EDITION = 'community';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.RAAS_LICENSE_SECRET = TEST_LICENSE_SECRET;
    delete process.env.RAAS_LICENSE_KEY;
    mockGetCurrentUser.mockReset();
    mockGetUserTier.mockReset();
    mockResolveOrgId.mockReset();
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns 401 when unauthenticated on GET or POST', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const getRes = await getStatus(new NextRequest('http://localhost:3000/api/open-core/status'));
    expect(getRes.status).toBe(401);

    const postRes = await postStatus(
      new NextRequest('http://localhost:3000/api/open-core/status', {
        method: 'POST',
        body: JSON.stringify({ licenseKey: 'SOPHIA-RAAS-v1.abc.def' }),
      }),
    );
    expect(postRes.status).toBe(401);
  });

  it('GET returns community edition with 4 unlocked COMMUNITY features for self-hosted user', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_1', email: 'dev@agency.vn' });
    mockGetUserTier.mockResolvedValue('BASIC');

    const res = await getStatus(new NextRequest('http://localhost:3000/api/open-core/status'));
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      mode: string;
      edition: string;
      features: Array<{ allowed: boolean }>;
    };
    expect(json.mode).toBe('runtime_status');
    expect(json.edition).toBe('community');
    expect(json.features.filter((f) => f.allowed).length).toBe(4);
  });

  it('POST validates an org-bound MASTER license preview without leaking orgId', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_1', email: 'ceo@agency.vn' });
    mockResolveOrgId.mockResolvedValue('org_vn_01');

    const token = await issueRaasLicenseToken(
      {
        licenseId: 'lic_master_route_01',
        orgId: 'org_vn_01',
        edition: 'enterprise',
        tier: 'MASTER',
        issuedAt: 1700000000,
        expiresAt: 2000000000,
        whiteLabelEnabled: true,
      },
      TEST_LICENSE_SECRET,
    );

    const res = await postStatus(
      new NextRequest('http://localhost:3000/api/open-core/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: token }),
      }),
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      valid: boolean;
      mode: string;
      persisted: boolean;
      licenseSummary: Record<string, unknown>;
      features: Array<{ allowed: boolean }>;
    };
    expect(json.valid).toBe(true);
    expect(json.mode).toBe('validation_preview');
    expect(json.persisted).toBe(false);
    expect(json.licenseSummary.orgId).toBeUndefined();
    expect(json.features.every((f) => f.allowed)).toBe(true);
  });

  it('POST returns 403 ORG_MISMATCH when token belongs to another organization', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_1', email: 'ceo@agency.vn' });
    mockResolveOrgId.mockResolvedValue('org_vn_01');

    const foreignToken = await issueRaasLicenseToken(
      {
        licenseId: 'lic_other_01',
        orgId: 'org_foreign_99',
        edition: 'enterprise',
        tier: 'ENTERPRISE',
        issuedAt: 1700000000,
        expiresAt: 2000000000,
      },
      TEST_LICENSE_SECRET,
    );

    const res = await postStatus(
      new NextRequest('http://localhost:3000/api/open-core/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: foreignToken }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe('/api/open-core/portability route', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset();
    mockLoadUserPortableConfig.mockReset();
    mockSaveUserPortableConfig.mockReset();
  });

  it('exports persisted D1 config and persists validated bundle on POST', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_open_core_1', email: 'dev@agency.vn' });
    mockLoadUserPortableConfig.mockResolvedValue({
      defaultLocale: 'vi',
      routingStrategy: 'costOptimized',
      configuredProviders: ['openrouter', 'heygen'],
      channelPresets: [{ slug: 'ai-news', niche: 'tech', locale: 'vi', cadencePerWeek: 5 }],
    });
    mockSaveUserPortableConfig.mockResolvedValue({ persisted: true });

    const exportRes = await getPortability(
      new NextRequest('http://localhost:3000/api/open-core/portability'),
    );
    expect(exportRes.status).toBe(200);
    const exportedJson = (await exportRes.json()) as {
      bundle: { config: Record<string, unknown>; checksumHex: string };
    };

    const importRes = await postPortability(
      new NextRequest('http://localhost:3000/api/open-core/portability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportedJson.bundle),
      }),
    );
    expect(importRes.status).toBe(200);
    const importedJson = (await importRes.json()) as {
      persisted: boolean;
      importedConfig: { routingStrategy: string; configuredProviders: string[] };
    };
    expect(importedJson.persisted).toBe(true);
    expect(importedJson.importedConfig.routingStrategy).toBe('costOptimized');
    expect(mockSaveUserPortableConfig).toHaveBeenCalledTimes(1);
  });
});
