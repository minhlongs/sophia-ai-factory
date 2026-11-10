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
import {
  VERIFIED_CATALOG_SHA256,
  createVerifiedCatalogArtifactProbe,
} from '../open-core-verified-artifacts-snapshot';
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

    const entToken = await issueRaasLicenseToken(
      { licenseId: 'lic_ent', orgId: 'org_1', edition: 'enterprise', tier: 'ENTERPRISE', issuedAt: 1700000000, expiresAt: 2000000000 },
      LICENSE_SECRET,
    );
    const masterToken = await issueRaasLicenseToken(
      { licenseId: 'lic_mst', orgId: 'org_1', edition: 'enterprise', tier: 'MASTER', issuedAt: 1700000000, expiresAt: 2000000000 },
      LICENSE_SECRET,
    );

    const cloudMatrix: Array<{ id: SophiaModuleFeatureId; allowTier: Tier }> = [
      { id: 'managed_social_oauth_relay', allowTier: 'PREMIUM' },
      { id: 'growth_triad_bandit_kelly', allowTier: 'PREMIUM' },
      { id: 'affiliate_attribution_payouts', allowTier: 'BASIC' },
      { id: 'multi_tenant_saas_billing', allowTier: 'ENTERPRISE' },
    ];
    for (const { id, allowTier } of cloudMatrix) {
      const denied = await enforceCommercialFeatureForUser('usr_1', id, {
        resolvedTier: allowTier,
        envOverrides: { sophiaEdition: 'community', appUrl: 'http://localhost:3000' },
      });
      expect(denied.ok, `${id} must deny on community`).toBe(false);

      const allowed = await enforceCommercialFeatureForUser('usr_1', id, {
        resolvedTier: allowTier,
        envOverrides: { sophiaEdition: 'cloud', appUrl: 'https://sophia.agencyos.network' },
      });
      expect(allowed.ok, `${id} must allow on cloud with ${allowTier}`).toBe(true);
    }

    const enterpriseIds: SophiaModuleFeatureId[] = [
      'white_label_agency_portal',
      'custom_domain_provisioning',
      'merkle_ipo_audit_vault',
    ];
    for (const id of enterpriseIds) {
      const deniedSelfHost = await enforceCommercialFeatureForUser('usr_1', id, {
        resolvedTier: 'ENTERPRISE',
        envOverrides: { sophiaEdition: 'enterprise', appUrl: 'http://localhost:3000', raasLicenseKey: '', raasLicenseSecret: LICENSE_SECRET },
      });
      expect(deniedSelfHost.ok, `${id} must deny self-host without RaaS license`).toBe(false);

      const deniedLowTierCloud = await enforceCommercialFeatureForUser('usr_1', id, {
        resolvedTier: 'PREMIUM',
        envOverrides: { sophiaEdition: 'cloud', appUrl: 'https://sophia.agencyos.network' },
      });
      expect(deniedLowTierCloud.ok, `${id} must deny PREMIUM cloud user`).toBe(false);

      const allowed = await enforceCommercialFeatureForUser('usr_1', id, {
        resolvedTier: 'ENTERPRISE',
        envOverrides: { sophiaEdition: 'enterprise', appUrl: 'http://localhost:3000', raasLicenseKey: entToken, raasLicenseSecret: LICENSE_SECRET },
      });
      expect(allowed.ok, `${id} must allow with ENTERPRISE RaaS license`).toBe(true);
    }

    const masterDeniedByEnt = await enforceCommercialFeatureForUser('usr_1', 'day1_master_handover_suite', {
      resolvedTier: 'ENTERPRISE',
      envOverrides: { sophiaEdition: 'enterprise', raasLicenseKey: entToken, raasLicenseSecret: LICENSE_SECRET },
    });
    expect(masterDeniedByEnt.ok).toBe(false);

    const masterAllowed = await enforceCommercialFeatureForUser('usr_1', 'day1_master_handover_suite', {
      resolvedTier: 'MASTER',
      envOverrides: { sophiaEdition: 'enterprise', raasLicenseKey: masterToken, raasLicenseSecret: LICENSE_SECRET },
    });
    expect(masterAllowed.ok).toBe(true);
  });

  it('enforces FEATURE_LOCKED and licensed allow on billing, finance vault, and handover boundaries', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_admin', email: 'cfo@agency.vn', role: 'admin' });
    mockIsUserAdminWithRole.mockResolvedValue({ isAdmin: true, role: 'admin' });
    mockExecuteSignHandover.mockResolvedValue(success({ certificate: { id: 'cert_1' }, record: { id: 'ho_1' } }));

    process.env.SOPHIA_EDITION = 'community';
    const fakeDb = {} as unknown as D1Database;

    const billingDenied = await assertBillingAccess(fakeDb, 'org_1');
    expect(billingDenied.ok).toBe(false);
    if (!billingDenied.ok) expect(billingDenied.error.code).toBe('FEATURE_LOCKED');

    const financeDenied = await assertFinanceAdminAccess();
    expect(financeDenied.ok).toBe(false);
    if (!financeDenied.ok) expect(financeDenied.error.code).toBe('FEATURE_LOCKED');

    const handoverDenied = await signHandoverAcceptanceAction({ handoverId: 'ho_1', acceptedByName: 'CEO', acceptedTerms: true } as never);
    expect(handoverDenied.ok).toBe(false);
    if (!handoverDenied.ok) expect(handoverDenied.error.code).toBe('FEATURE_LOCKED');

    const domainDenied = await assertMasterTierAndOrgAccess(fakeDb, 'org_1');
    expect(domainDenied.ok).toBe(false);
    if (!domainDenied.ok) expect(domainDenied.error.code).toBe('FEATURE_LOCKED');

    const ipoDenied = await assertIpoAdminAccess();
    expect(ipoDenied.ok).toBe(false);
    if (!ipoDenied.ok) expect(ipoDenied.error.code).toBe('FEATURE_LOCKED');

    const reviewDenied = await getClientReview(
      new NextRequest('http://localhost:3000/api/client-review/tok_1'),
      { params: Promise.resolve({ token: 'tok_1' }) },
    );
    expect(reviewDenied.status).toBe(403);

    const affDenied = await getAffiliatePayouts(
      new NextRequest('http://localhost:3000/api/affiliate/payouts'),
    );
    expect(affDenied.status).toBe(403);

    const reviewOwnerDenied = await getClientReview(
      new NextRequest('http://localhost:3000/api/client-review/tok_1'),
      { params: Promise.resolve({ token: 'tok_1' }) },
    );
    expect(reviewOwnerDenied.status).toBe(403);

    const masterToken = await issueRaasLicenseToken(
      { licenseId: 'lic_mst_live', orgId: 'org_1', edition: 'enterprise', tier: 'MASTER', issuedAt: 1700000000, expiresAt: 2000000000 },
      LICENSE_SECRET,
    );
    process.env.SOPHIA_EDITION = 'enterprise';
    process.env.RAAS_LICENSE_KEY = masterToken;

    expect((await assertBillingAccess(fakeDb, 'org_1')).ok).toBe(true);
    expect((await assertFinanceAdminAccess()).ok).toBe(true);
    expect((await assertMasterTierAndOrgAccess(fakeDb, 'org_1')).ok).toBe(true);
    expect((await assertIpoAdminAccess()).ok).toBe(true);
    expect((await signHandoverAcceptanceAction({ handoverId: 'ho_1', acceptedByName: 'CEO', acceptedTerms: true } as never)).ok).toBe(true);

    const validProbe = await createVerifiedCatalogArtifactProbe(VERIFIED_CATALOG_SHA256);
    expect(validProbe('README.md')).toBe(true);
    const driftedProbe = await createVerifiedCatalogArtifactProbe('f'.repeat(64));
    expect(driftedProbe('README.md')).toBe(false);
  });
});
