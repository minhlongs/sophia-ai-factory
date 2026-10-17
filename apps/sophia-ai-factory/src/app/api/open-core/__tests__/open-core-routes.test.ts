/**
 * Unit & integration tests for /api/open-core/status and /api/open-core/portability
 *
 * @module app/api/open-core/__tests__/open-core-routes.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetCurrentUser = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
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
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('GET returns community edition and 12 evaluated feature gates by default', async () => {
    const req = new NextRequest('http://localhost:3000/api/open-core/status');
    const res = await getStatus(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      edition: string;
      features: Array<{ allowed: boolean; feature: { scope: string } }>;
    };
    expect(json.success).toBe(true);
    expect(json.edition).toBe('community');
    expect(json.features.length).toBe(12);

    const unlocked = json.features.filter((f) => f.allowed);
    expect(unlocked.length).toBe(4);
  });

  it('POST verifies a valid MASTER RaaS license token and unlocks all 12 features', async () => {
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

    const req = new NextRequest('http://localhost:3000/api/open-core/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: token }),
    });

    const res = await postStatus(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      valid: boolean;
      edition: string;
      features: Array<{ allowed: boolean }>;
    };
    expect(json.success).toBe(true);
    expect(json.valid).toBe(true);
    expect(json.edition).toBe('enterprise');
    expect(json.features.every((f) => f.allowed)).toBe(true);
  });

  it('POST returns 422 when given a tampered RaaS license token', async () => {
    const req = new NextRequest('http://localhost:3000/api/open-core/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: 'SOPHIA-RAAS-v1.eyJbad.00000000' }),
    });

    const res = await postStatus(req);
    expect(res.status).toBe(422);
  });
});

describe('/api/open-core/portability route', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset();
  });

  it('returns 401 when user is unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/open-core/portability');
    const res = await getPortability(req);
    expect(res.status).toBe(401);
  });

  it('exports and re-imports a signed workspace bundle for an authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_open_core_1', email: 'dev@agency.vn' });

    const exportReq = new NextRequest(
      'http://localhost:3000/api/open-core/portability?locale=vi&routingStrategy=costOptimized&providers=openrouter,heygen',
    );
    const exportRes = await getPortability(exportReq);
    expect(exportRes.status).toBe(200);

    const exportedJson = (await exportRes.json()) as {
      success: boolean;
      bundle: { config: Record<string, unknown>; checksumHex: string };
    };
    expect(exportedJson.success).toBe(true);

    const importReq = new NextRequest('http://localhost:3000/api/open-core/portability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exportedJson.bundle),
    });
    const importRes = await postPortability(importReq);
    expect(importRes.status).toBe(200);

    const importedJson = (await importRes.json()) as {
      success: boolean;
      importedConfig: { routingStrategy: string; configuredProviders: string[] };
    };
    expect(importedJson.success).toBe(true);
    expect(importedJson.importedConfig.routingStrategy).toBe('costOptimized');
    expect(importedJson.importedConfig.configuredProviders).toEqual(['openrouter', 'heygen']);
  });
});
