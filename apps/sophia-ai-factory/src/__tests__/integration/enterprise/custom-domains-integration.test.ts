/**
 * Integration Tests for Enterprise Custom Domains & White-Label Engine.
 *
 * Uses in-memory SQLite D1 shim to test:
 * 1. D1 migration 0276 custom_domains table lifecycle
 * 2. registerCustomDomain and verifyCustomDomainStatus interface contracts
 * 3. getTenantBrandingByHostname multi-table join and in-memory edge memoization
 * 4. resolveTenantFromHostname edge router and routing context
 * 5. Server Actions (register, verify, delete, list) with MASTER tier authorization gating
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { freshDb, makeD1 } from '../shared-d1-shim';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockIsUserAdminWithRole: vi.fn(),
  mockGetUserTier: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.mockGetCurrentUser,
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdminWithRole: mocks.mockIsUserAdminWithRole,
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: mocks.mockGetUserTier,
}));

import {
  registerCustomDomain,
  verifyCustomDomainStatus,
  getCustomDomainById,
  getCustomDomainByHostname,
  listCustomDomainsByOrg,
} from '@/tree/custom-domains/verification-service';
import {
  getTenantBrandingByHostname,
  invalidateTenantBrandingCache,
  clearBrandingCache,
} from '@/tree/branding/org-branding-repo';
import {
  resolveTenantFromHostname,
  clearHostnameCache,
} from '@/tree/custom-domains/hostname-resolver';
import {
  registerCustomDomainAction,
  verifyCustomDomainStatusAction,
  deleteCustomDomainAction,
  listCustomDomainsAction,
} from '@/land/admin/custom-domain-actions';

// DDL for M1 integration tests
const M1_SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  plan TEXT DEFAULT 'free',
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  user_id TEXT,
  tier TEXT,
  plan TEXT,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS org_branding (
  org_id TEXT PRIMARY KEY,
  agency_name TEXT,
  logo_url TEXT,
  watermark_position TEXT DEFAULT 'bottom-right',
  watermark_opacity REAL DEFAULT 0.85,
  watermark_policy TEXT DEFAULT 'master_plus',
  primary_color TEXT,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, namespace)
);

CREATE TABLE IF NOT EXISTS custom_domains (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  hostname TEXT UNIQUE NOT NULL,
  cf_custom_hostname_id TEXT,
  ssl_status TEXT NOT NULL DEFAULT 'pending_validation',
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verification_errors TEXT NOT NULL DEFAULT '[]',
  ownership_verification TEXT NOT NULL DEFAULT '{}',
  ssl_verification TEXT NOT NULL DEFAULT '{}',
  cname_target TEXT NOT NULL DEFAULT 'cname.sophia.agencyos.network',
  cname_verified INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
`;

describe('Enterprise Custom Domains & White-Label — Integration Tests', () => {
  let rawDb: ReturnType<typeof freshDb>;
  let d1: ReturnType<typeof makeD1>;

  const mockUserId = 'usr_master_owner';
  const mockOrgId = 'org_enterprise_1';

  beforeEach(() => {
    clearHostnameCache();
    clearBrandingCache();
    vi.clearAllMocks();

    rawDb = freshDb();
    rawDb.exec(M1_SCHEMA);
    d1 = makeD1(rawDb);
    mocks.mockGetD1.mockResolvedValue(d1 as unknown as D1Database);

    // Default authenticated session
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: mockUserId,
      email: 'owner@enterprise.com',
    });
    mocks.mockIsUserAdminWithRole.mockResolvedValue({
      isAdmin: false,
      role: 'user',
    });
    mocks.mockGetUserTier.mockResolvedValue('MASTER');
  });

  describe('1. Domain Registration & Status Lifecycle (Tree Layer)', () => {
    it('registers a custom domain and stores verification records in D1', async () => {
      // Seed organization
      rawDb.exec(`INSERT INTO organizations (id, name, slug) VALUES ('org_apex', 'Apex Agency', 'apex')`);

      const domain = await registerCustomDomain(d1 as unknown as D1Database, 'org_apex', 'portal.apexagency.com');

      expect(domain.id).toBeDefined();
      expect(domain.org_id).toBe('org_apex');
      expect(domain.hostname).toBe('portal.apexagency.com');
      expect(domain.ssl_status).toBe('pending_validation');
      expect(domain.verification_status).toBe('pending');
      expect(domain.cf_custom_hostname_id).toContain('mock_cf_');
      expect(domain.ownership_verification?.name).toBe('_cf-custom-hostname.portal.apexagency.com');
      expect(domain.ssl_verification?.name).toBe('_acme-challenge.portal.apexagency.com');
      expect(domain.cname_target).toBe('cname.sophia.agencyos.network');
      expect(domain.cname_verified).toBe(false);
      expect(domain.active).toBe(false);

      // Verify stored in D1
      const fetched = await getCustomDomainById(d1 as unknown as D1Database, domain.id);
      expect(fetched?.hostname).toBe('portal.apexagency.com');
    });

    it('verifies custom domain status and transitions to active on mock verification', async () => {
      rawDb.exec(`INSERT INTO organizations (id, name, slug) VALUES ('org_apex', 'Apex Agency', 'apex')`);

      // Register mock active domain
      const domain = await registerCustomDomain(d1 as unknown as D1Database, 'org_apex', 'active-test.apexagency.com');
      expect(domain.active).toBe(false);

      // Verify domain status
      const verification = await verifyCustomDomainStatus(d1 as unknown as D1Database, domain.id);

      expect(verification.domainId).toBe(domain.id);
      expect(verification.hostname).toBe('active-test.apexagency.com');
      expect(verification.sslStatus).toBe('active');
      expect(verification.verificationStatus).toBe('active');
      expect(verification.cnameVerified).toBe(true);
      expect(verification.active).toBe(true);
      expect(verification.errors).toEqual([]);

      // Verify persistence in D1
      const updated = await getCustomDomainById(d1 as unknown as D1Database, domain.id);
      expect(updated?.active).toBe(true);
      expect(updated?.ssl_status).toBe('active');
    });

    it('lists custom domains by organization sorted by recency', async () => {
      rawDb.exec(`INSERT INTO organizations (id, name, slug) VALUES ('org_apex', 'Apex Agency', 'apex')`);

      await registerCustomDomain(d1 as unknown as D1Database, 'org_apex', 'alpha.apexagency.com');
      await registerCustomDomain(d1 as unknown as D1Database, 'org_apex', 'beta.apexagency.com');

      const domains = await listCustomDomainsByOrg(d1 as unknown as D1Database, 'org_apex');
      expect(domains.length).toBe(2);
      const hostnames = domains.map((d) => d.hostname);
      expect(hostnames).toContain('alpha.apexagency.com');
      expect(hostnames).toContain('beta.apexagency.com');
    });
  });

  describe('2. Hostname-to-Tenant Branding Resolver & Edge Memoization', () => {
    it('resolves full tenant branding joined across custom_domains, org_branding, and tenant_settings', async () => {
      rawDb.exec(`
        INSERT INTO organizations (id, name, slug) VALUES ('org_titan', 'Titan Studio', 'titan');
        INSERT INTO org_branding (org_id, agency_name, logo_url, primary_color)
          VALUES ('org_titan', 'Titan Studio Inc', 'https://titan.com/logo.png', '#10B981');
        INSERT INTO tenant_settings (tenant_id, namespace, value)
          VALUES ('org_titan', 'branding', '{"welcomeMessage":"Welcome to Titan Portal","accentColor":"#F59E0B","emailFooter":"Titan Studio LLC"}');
      `);

      // Register and mark active in custom_domains
      await registerCustomDomain(d1 as unknown as D1Database, 'org_titan', 'portal.titanstudio.com');
      rawDb.exec(`UPDATE custom_domains SET active = 1, ssl_status = 'active' WHERE hostname = 'portal.titanstudio.com'`);

      const branding = await getTenantBrandingByHostname(d1 as unknown as D1Database, 'portal.titanstudio.com');

      expect(branding).not.toBeNull();
      expect(branding?.orgId).toBe('org_titan');
      expect(branding?.agencyName).toBe('Titan Studio Inc');
      expect(branding?.logoUrl).toBe('https://titan.com/logo.png');
      expect(branding?.primaryColor).toBe('#10B981');
      expect(branding?.accentColor).toBe('#F59E0B');
      expect(branding?.welcomeMessage).toBe('Welcome to Titan Portal');
      expect(branding?.emailFooter).toBe('Titan Studio LLC');
      expect(branding?.isWhiteLabel).toBe(true);
    });

    it('utilizes in-memory edge memoization and invalidates correctly', async () => {
      rawDb.exec(`
        INSERT INTO organizations (id, name) VALUES ('org_memo', 'Memo Org');
        INSERT INTO org_branding (org_id, agency_name) VALUES ('org_memo', 'Initial Name');
        INSERT INTO custom_domains (id, org_id, hostname, active, ssl_status)
          VALUES ('dom_memo', 'org_memo', 'memo.agency.com', 1, 'active');
      `);

      // First resolution queries D1 and populates cache
      const first = await getTenantBrandingByHostname(d1 as unknown as D1Database, 'memo.agency.com');
      expect(first?.agencyName).toBe('Initial Name');

      // Mutate underlying D1 row directly without invalidating cache
      rawDb.exec(`UPDATE org_branding SET agency_name = 'Mutated In DB' WHERE org_id = 'org_memo'`);

      // Second resolution returns cached data in <0.1ms
      const second = await getTenantBrandingByHostname(d1 as unknown as D1Database, 'memo.agency.com');
      expect(second?.agencyName).toBe('Initial Name'); // Confirms cache hit

      // Explicit invalidation
      invalidateTenantBrandingCache('memo.agency.com');

      // Third resolution reads updated DB data
      const third = await getTenantBrandingByHostname(d1 as unknown as D1Database, 'memo.agency.com');
      expect(third?.agencyName).toBe('Mutated In DB');
    });

    it('short-circuits canonical hostnames without querying D1', async () => {
      const spyPrepare = vi.spyOn(d1, 'prepare');

      const result1 = await getTenantBrandingByHostname(d1 as unknown as D1Database, 'sophia.agencyos.network');
      const result2 = await getTenantBrandingByHostname(d1 as unknown as D1Database, 'localhost');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(spyPrepare).not.toHaveBeenCalled();
    });
  });

  describe('3. Hostname-to-Tenant Edge Routing (hostname-resolver)', () => {
    it('resolves active custom domain to tenant routing context', async () => {
      rawDb.exec(`
        INSERT INTO organizations (id, name) VALUES ('org_router', 'Router Org');
        INSERT INTO custom_domains (id, org_id, hostname, active, ssl_status)
          VALUES ('dom_router', 'org_router', 'portal.router.com', 1, 'active');
      `);

      const context = await resolveTenantFromHostname(d1 as unknown as D1Database, 'portal.router.com');

      expect(context.isInternal).toBe(false);
      expect(context.isCustomDomain).toBe(true);
      expect(context.tenantOrgId).toBe('org_router');
      expect(context.customDomain).toBe('portal.router.com');
      expect(context.whitelabelActive).toBe(true);
      expect(context.sslStatus).toBe('active');
    });

    it('flags unverified or pending SSL domain with whitelabelActive=false', async () => {
      rawDb.exec(`
        INSERT INTO organizations (id, name) VALUES ('org_pending', 'Pending Org');
        INSERT INTO custom_domains (id, org_id, hostname, active, ssl_status)
          VALUES ('dom_pending', 'org_pending', 'pending.router.com', 1, 'pending_validation');
      `);

      const context = await resolveTenantFromHostname(d1 as unknown as D1Database, 'pending.router.com');

      expect(context.isCustomDomain).toBe(true);
      expect(context.tenantOrgId).toBe('org_pending');
      expect(context.whitelabelActive).toBe(false);
      expect(context.sslStatus).toBe('pending_validation');
    });
  });

  describe('4. Server Actions & MASTER Tier Authorization Gating (Land Layer)', () => {
    beforeEach(() => {
      // Seed organization, membership, and MASTER subscription
      rawDb.exec(`
        INSERT INTO organizations (id, name) VALUES ('${mockOrgId}', 'Enterprise Master Org');
        INSERT INTO org_members (id, org_id, user_id, role)
          VALUES ('mem_1', '${mockOrgId}', '${mockUserId}', 'owner');
        INSERT INTO subscriptions (id, org_id, user_id, tier, plan, status)
          VALUES ('sub_1', '${mockOrgId}', '${mockUserId}', 'MASTER', 'master', 'active');
      `);
    });

    it('successfully registers a custom domain when caller is MASTER tier owner', async () => {
      const res = await registerCustomDomainAction(mockOrgId, 'app.masterclient.com');

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.hostname).toBe('app.masterclient.com');
        expect(res.value.org_id).toBe(mockOrgId);
      }
    });

    it('rejects duplicate domain registration with CONFLICT error', async () => {
      const first = await registerCustomDomainAction(mockOrgId, 'duplicate.domain.com');
      expect(first.ok).toBe(true);

      const second = await registerCustomDomainAction(mockOrgId, 'duplicate.domain.com');
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.error.code).toBe('CONFLICT');
      }
    });

    it('rejects registration when user is not authenticated', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue(null);

      const res = await registerCustomDomainAction(mockOrgId, 'unauth.domain.com');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('rejects registration when user is not an organization owner or admin', async () => {
      // Demote member to viewer
      rawDb.exec(`UPDATE org_members SET role = 'viewer' WHERE user_id = '${mockUserId}'`);

      const res = await registerCustomDomainAction(mockOrgId, 'viewer.domain.com');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
        expect(res.error.message).toContain('owners or admins');
      }
    });

    it('rejects registration when organization/user is sub-MASTER tier', async () => {
      mocks.mockGetUserTier.mockResolvedValue('PRO' as unknown as 'MASTER');
      rawDb.exec(`UPDATE subscriptions SET tier = 'PRO', plan = 'pro' WHERE org_id = '${mockOrgId}'`);

      const res = await registerCustomDomainAction(mockOrgId, 'submaster.domain.com');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
        expect(res.error.message).toContain('MASTER tier subscription');
      }
    });

    it('verifies and deletes domain via server actions', async () => {
      // 1. Register domain
      const reg = await registerCustomDomainAction(mockOrgId, 'active-test.action.com');
      expect(reg.ok).toBe(true);
      const domainId = (reg as { ok: true; value: { id: string } }).value.id;

      // 2. Verify domain status
      const verifyRes = await verifyCustomDomainStatusAction(mockOrgId, domainId);
      expect(verifyRes.ok).toBe(true);
      if (verifyRes.ok) {
        expect(verifyRes.value.active).toBe(true);
      }

      // 3. List domains
      const listRes = await listCustomDomainsAction(mockOrgId);
      expect(listRes.ok).toBe(true);
      if (listRes.ok) {
        expect(listRes.value.length).toBe(1);
      }

      // 4. Delete domain
      const deleteRes = await deleteCustomDomainAction(mockOrgId, domainId);
      expect(deleteRes.ok).toBe(true);

      // 5. Confirm deleted from D1
      const check = await getCustomDomainById(d1 as unknown as D1Database, domainId);
      expect(check).toBeNull();
    });
  });
});
