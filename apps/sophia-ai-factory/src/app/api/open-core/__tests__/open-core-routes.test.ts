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
const mockAuditVideoBlueprintCatalog = vi.fn();

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
vi.mock('@/tree/open-core/video-blueprint-auditor', () => ({
  auditVideoBlueprintCatalog: () => mockAuditVideoBlueprintCatalog(),
}));

import { GET as getStatus, POST as postStatus } from '../status/route';
import { GET as getPortability, POST as postPortability } from '../portability/route';
import { issueRaasLicenseToken } from '@/seed/security/raas-license-verifier';

const TEST_LICENSE_SECRET = 'sophia-raas-license-route-secret-2026';

describe('/api/open-core/status & /portability routes', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.SOPHIA_EDITION = 'community';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.RAAS_LICENSE_SECRET = TEST_LICENSE_SECRET;
    delete process.env.RAAS_LICENSE_KEY;
    mockGetCurrentUser.mockReset();
    mockGetUserTier.mockReset();
    mockResolveOrgId.mockReset();
    mockLoadUserPortableConfig.mockReset();
    mockSaveUserPortableConfig.mockReset();
    mockAuditVideoBlueprintCatalog.mockReset();
    mockAuditVideoBlueprintCatalog.mockReturnValue({
      totalBlueprints: 6,
      validBlueprints: 6,
      invalidBlueprintIds: [],
      duplicateBlueprintIds: [],
      catalogComplete: true,
    });
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

  it('GET returns community edition, 4 unlocked features, and catalog metadata summary', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_1', email: 'dev@agency.vn' });
    mockGetUserTier.mockResolvedValue('BASIC');

    const res = await getStatus(new NextRequest('http://localhost:3000/api/open-core/status'));
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      mode: string;
      edition: string;
      features: Array<{ allowed: boolean }>;
        catalogAudit: {
        totalSteps: number;
        documentedSteps: number;
        catalogCompletenessPercentage: number;
        catalogComplete: boolean;
      };
      blueprintAudit: {
        totalBlueprints: number;
        validBlueprints: number;
        invalidBlueprintIds: string[];
        duplicateBlueprintIds: string[];
        catalogComplete: boolean;
      } | null;
    };
    expect(json.mode).toBe('runtime_status');
    expect(json.edition).toBe('community');
    expect(json.features.filter((f) => f.allowed).length).toBe(4);
    expect(json.catalogAudit.totalSteps).toBe(25);
    expect(json.catalogAudit.documentedSteps).toBe(25);
    expect(json.catalogAudit.catalogCompletenessPercentage).toBe(100);
    expect(json.catalogAudit.catalogComplete).toBe(true);
    expect(json.blueprintAudit).toEqual({
      totalBlueprints: 6,
      validBlueprints: 6,
      invalidBlueprintIds: [],
      duplicateBlueprintIds: [],
      catalogComplete: true,
    });
  });

  it('keeps runtime status available with a null blueprint audit if the optional audit fails', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_1', email: 'dev@agency.vn' });
    mockGetUserTier.mockResolvedValue('BASIC');
    mockAuditVideoBlueprintCatalog.mockImplementationOnce(() => {
      throw new Error('blueprint audit unavailable');
    });

    const res = await getStatus(new NextRequest('http://localhost:3000/api/open-core/status'));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { blueprintAudit: unknown; catalogAudit: { catalogComplete: boolean } };
    expect(json.blueprintAudit).toBeNull();
    expect(json.catalogAudit.catalogComplete).toBe(true);
  });

  it('POST validates an org-bound MASTER license preview and rejects foreign org tokens', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_1', email: 'ceo@agency.vn' });
    mockResolveOrgId.mockResolvedValue('org_vn_01');

    const validToken = await issueRaasLicenseToken(
      {
        licenseId: 'lic_master_01', orgId: 'org_vn_01', edition: 'enterprise',
        tier: 'MASTER', issuedAt: 1700000000, expiresAt: 2000000000, whiteLabelEnabled: true,
      },
      TEST_LICENSE_SECRET,
    );

    const okRes = await postStatus(
      new NextRequest('http://localhost:3000/api/open-core/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: validToken }),
      }),
    );
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as {
      valid: boolean; licenseSummary: Record<string, unknown>; features: Array<{ allowed: boolean }>;
    };
    expect(okJson.valid).toBe(true);
    expect(okJson.licenseSummary.orgId).toBeUndefined();
    expect(okJson.features.every((f) => f.allowed)).toBe(true);

    const foreignToken = await issueRaasLicenseToken(
      {
        licenseId: 'lic_other_01', orgId: 'org_foreign_99', edition: 'enterprise',
        tier: 'ENTERPRISE', issuedAt: 1700000000, expiresAt: 2000000000,
      },
      TEST_LICENSE_SECRET,
    );
    const forbidRes = await postStatus(
      new NextRequest('http://localhost:3000/api/open-core/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: foreignToken }),
      }),
    );
    expect(forbidRes.status).toBe(403);
  });

  it('exports persisted D1 config and persists validated bundle on POST /portability', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_open_core_1', email: 'dev@agency.vn' });
    mockLoadUserPortableConfig.mockResolvedValue({
      defaultLocale: 'vi', routingStrategy: 'costOptimized',
      configuredProviders: ['openrouter', 'heygen'],
      channelPresets: [{ slug: 'ai-news', niche: 'tech', locale: 'vi', cadencePerWeek: 5 }],
    });
    mockSaveUserPortableConfig.mockResolvedValue({ persisted: true });

    const exportRes = await getPortability(new NextRequest('http://localhost:3000/api/open-core/portability'));
    expect(exportRes.status).toBe(200);
    const exportedJson = (await exportRes.json()) as {
      bundle: { config: Record<string, unknown>; checksumHex: string };
    };
    expect(exportedJson.bundle.config.defaultLocale).toBe('vi');
    expect(exportedJson.bundle.config.routingStrategy).toBe('costOptimized');
    expect(exportedJson.bundle.config.configuredProviders).toEqual(['openrouter', 'heygen']);
    expect(exportedJson.bundle.checksumHex).toMatch(/^[0-9a-f]{64}$/);

    const importRes = await postPortability(
      new NextRequest('http://localhost:3000/api/open-core/portability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportedJson.bundle),
      }),
    );
    expect(importRes.status).toBe(200);
    expect(mockSaveUserPortableConfig).toHaveBeenCalledTimes(1);
    const importedJson = (await importRes.json()) as {
      persisted: boolean;
      importedConfig: Record<string, unknown>;
    };
    expect(mockSaveUserPortableConfig).toHaveBeenCalledWith(
      'usr_open_core_1',
      exportedJson.bundle.config,
    );
    expect(importedJson.persisted).toBe(true);
    expect(importedJson.importedConfig).toEqual(exportedJson.bundle.config);
  });
});
