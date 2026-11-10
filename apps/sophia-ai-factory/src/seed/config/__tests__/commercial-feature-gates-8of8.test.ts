/**
 * Verifies all 8/8 commercial features in OPEN_CORE_FEATURES enforce both
 * denied and allowed branches server-side, plus live boundary guards for
 * billing, finance audit vault, and Day-1 Master handover actions.
 *
 * @module seed/config/__tests__/commercial-feature-gates-8of8
 */

import type { D1Database } from '@cloudflare/workers-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCurrentUser = vi.fn();
const mockIsUserAdminWithRole = vi.fn();
const mockExecuteSignHandover = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));
vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdminWithRole: (...args: unknown[]) => mockIsUserAdminWithRole(...args),
  isUserAdmin: async () => true,
}));
vi.mock('@/land/actions/handover/handover-action-helpers', () => ({
  executeSignHandoverAcceptance: (...args: unknown[]) => mockExecuteSignHandover(...args),
}));

import { NextRequest } from 'next/server';
import { enforceCommercialFeatureForUser } from '../enforce-commercial-feature-server';
import { OPEN_CORE_FEATURES, type SophiaModuleFeatureId } from '../open-core-manifest';
import { VERIFIED_CATALOG_SHA256, createVerifiedCatalogArtifactProbe } from '../open-core-verified-artifacts-snapshot';
import { issueRaasLicenseToken } from '@/seed/security/raas-license-verifier';
import type { Tier } from '@/seed/types';
import { success } from '@/seed/types/result';
import { GET as getAffiliatePayouts } from '@/app/api/affiliate/payouts/route';
import { GET as getClientReview } from '@/app/api/client-review/[token]/route';
import { assertMasterTierAndOrgAccess } from '@/land/admin/domain/domain-access';
import { assertBillingAccess } from '@/land/billing/invoices/auth-check';
import { assertFinanceAdminAccess } from '@/land/finance/close/reconciliation-checker';
import { assertIpoAdminAccess } from '@/land/ipo/actions/common';
import { signHandoverAcceptanceAction } from '@/land/actions/handover/handover-actions';

const LICENSE_SECRET = 'sophia-commercial-gates-test-secret-2026';

describe('8/8 Commercial Feature Gates — Server Enforcement Contract', () => {
  const origEnv = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAAS_LICENSE_SECRET = LICENSE_SECRET;
    delete process.env.RAAS_LICENSE_KEY;
    delete process.env.SOPHIA_EDITION;
  });
  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('covers every non-COMMUNITY feature in OPEN_CORE_FEATURES across denied and allowed branches', async () => {
    const commercialIds = (Object.keys(OPEN_CORE_FEATURES) as SophiaModuleFeatureId[]).filter(
      (id) => OPEN_CORE_FEATURES[id].scope !== 'COMMUNITY',
    );
    expect(commercialIds).toHaveLength(8);

    const entToken = await issueRaasLicenseToken({ licenseId: 'lic_ent', orgId: 'org_1', edition: 'enterprise', tier: 'ENTERPRISE', issuedAt: 1700000000, expiresAt: 2000000000 }, LICENSE_SECRET);
    const masterToken = await issueRaasLicenseToken({ licenseId: 'lic_mst', orgId: 'org_1', edition: 'enterprise', tier: 'MASTER', issuedAt: 1700000000, expiresAt: 2000000000 }, LICENSE_SECRET);

    const cloudMatrix: Array<{ id: SophiaModuleFeatureId; allowTier: Tier }> = [
      { id: 'managed_social_oauth_relay', allowTier: 'PREMIUM' },
      { id: 'growth_triad_bandit_kelly', allowTier: 'PREMIUM' },
      { id: 'affiliate_attribution_payouts', allowTier: 'BASIC' },
      { id: 'multi_tenant_saas_billing', allowTier: 'ENTERPRISE' },
    ];
    for (const { id, allowTier } of cloudMatrix) {
      expect((await enforceCommercialFeatureForUser('usr_1', id, { resolvedTier: allowTier, envOverrides: { sophiaEdition: 'community', appUrl: 'http://localhost:3000' } })).ok).toBe(false);
      expect((await enforceCommercialFeatureForUser('usr_1', id, { resolvedTier: allowTier, envOverrides: { sophiaEdition: 'cloud', appUrl: 'https://sophia.agencyos.network' } })).ok).toBe(true);
    }

    const enterpriseIds: SophiaModuleFeatureId[] = ['white_label_agency_portal', 'custom_domain_provisioning', 'merkle_ipo_audit_vault'];
    for (const id of enterpriseIds) {
      expect((await enforceCommercialFeatureForUser('usr_1', id, { resolvedTier: 'ENTERPRISE', envOverrides: { sophiaEdition: 'enterprise', appUrl: 'http://localhost:3000', raasLicenseKey: '', raasLicenseSecret: LICENSE_SECRET } })).ok).toBe(false);
      expect((await enforceCommercialFeatureForUser('usr_1', id, { resolvedTier: 'PREMIUM', envOverrides: { sophiaEdition: 'cloud', appUrl: 'https://sophia.agencyos.network' } })).ok).toBe(false);
      expect((await enforceCommercialFeatureForUser('usr_1', id, { resolvedTier: 'ENTERPRISE', envOverrides: { sophiaEdition: 'enterprise', appUrl: 'http://localhost:3000', raasLicenseKey: entToken, raasLicenseSecret: LICENSE_SECRET } })).ok).toBe(true);
    }

    expect((await enforceCommercialFeatureForUser('usr_1', 'day1_master_handover_suite', { resolvedTier: 'ENTERPRISE', envOverrides: { sophiaEdition: 'enterprise', raasLicenseKey: entToken, raasLicenseSecret: LICENSE_SECRET } })).ok).toBe(false);
    expect((await enforceCommercialFeatureForUser('usr_1', 'day1_master_handover_suite', { resolvedTier: 'MASTER', envOverrides: { sophiaEdition: 'enterprise', raasLicenseKey: masterToken, raasLicenseSecret: LICENSE_SECRET } })).ok).toBe(true);
  });

  it('enforces FEATURE_LOCKED and licensed allow on billing, finance vault, and handover boundaries', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_admin', email: 'cfo@agency.vn', role: 'admin' });
    mockIsUserAdminWithRole.mockResolvedValue({ isAdmin: true, role: 'admin' });
    mockExecuteSignHandover.mockResolvedValue(success({ certificate: { id: 'cert_1' }, record: { id: 'ho_1' } }));
    process.env.SOPHIA_EDITION = 'community';
    const fakeDb = {} as unknown as D1Database;

    expect((await assertBillingAccess(fakeDb, 'org_1')).ok).toBe(false);
    expect((await assertFinanceAdminAccess()).ok).toBe(false);
    expect((await signHandoverAcceptanceAction({ handoverId: 'ho_1', acceptedByName: 'CEO', acceptedTerms: true } as never)).ok).toBe(false);
    expect((await assertMasterTierAndOrgAccess(fakeDb, 'org_1')).ok).toBe(false);
    expect((await assertIpoAdminAccess()).ok).toBe(false);
    expect((await getClientReview(new NextRequest('http://localhost:3000/api/client-review/tok_1'), { params: Promise.resolve({ token: 'tok_1' }) })).status).toBe(403);
    expect((await getAffiliatePayouts(new NextRequest('http://localhost:3000/api/affiliate/payouts'))).status).toBe(403);

    const masterToken = await issueRaasLicenseToken({ licenseId: 'lic_mst_live', orgId: 'org_1', edition: 'enterprise', tier: 'MASTER', issuedAt: 1700000000, expiresAt: 2000000000 }, LICENSE_SECRET);
    process.env.SOPHIA_EDITION = 'enterprise';
    process.env.RAAS_LICENSE_KEY = masterToken;
    expect((await assertBillingAccess(fakeDb, 'org_1')).ok).toBe(true);
    expect((await assertFinanceAdminAccess()).ok).toBe(true);
    expect((await assertMasterTierAndOrgAccess(fakeDb, 'org_1')).ok).toBe(true);
    expect((await assertIpoAdminAccess()).ok).toBe(true);
    expect((await signHandoverAcceptanceAction({ handoverId: 'ho_1', acceptedByName: 'CEO', acceptedTerms: true } as never)).ok).toBe(true);
    expect((await createVerifiedCatalogArtifactProbe(VERIFIED_CATALOG_SHA256))('README.md')).toBe(true);
    expect((await createVerifiedCatalogArtifactProbe('f'.repeat(64)))('README.md')).toBe(false);
  });
});
