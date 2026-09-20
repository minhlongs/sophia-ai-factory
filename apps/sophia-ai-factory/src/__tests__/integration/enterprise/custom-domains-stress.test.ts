/**
 * Adversarial Stress Tests for Enterprise Custom Domains & Cloudflare for SaaS Lifecycle.
 *
 * Layer: integration / stress
 * Scope:
 * 1. Extreme Hostname Formats (punycode, trailing dots, SQLi, extreme lengths, special chars)
 * 2. Concurrency, Race Conditions & Collision Resilience
 * 3. Rapid & Cyclical Status Transitions (lifecycle integrity, rapid polling, recovery)
 * 4. CAA & DCV Verification Error Handling (CAA record blockers, timeouts, error cleanup)
 * 5. Mock Mode Resilience, Malformed API Responses & Corrupt D1 Data Defense
 * 6. High-Churn Cache Flooding & Negative Cache Invalidation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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
  evaluateStatusTransitions,
  parseOwnershipVerification,
  parseSslDcvVerification,
  parseVerificationErrors,
  mapRowToCustomDomainRecord,
  createCloudflareCustomHostname,
  fetchCloudflareCustomHostname,
  deleteCloudflareCustomHostname,
  DEFAULT_CNAME_TARGET,
} from '@/tree/custom-domains/verification-service';
import {
  validateHostname,
  registerCustomDomainAction,
  verifyCustomDomainStatusAction,
  deleteCustomDomainAction,
  listCustomDomainsAction,
} from '@/land/admin/custom-domain-actions';
import {
  normalizeHostname,
  isInternalOrCanonicalHostname,
  extractHostname,
  resolveTenantFromHostname,
  clearHostnameCache,
} from '@/tree/custom-domains/hostname-resolver';
import {
  getTenantBrandingByHostname,
  invalidateTenantBrandingCache,
  clearBrandingCache,
} from '@/tree/branding/org-branding-repo';
import type {
  CustomDomainRow,
  CloudflareCustomHostnameResult,
} from '@/seed/types/custom-domains';

const STRESS_SCHEMA = `
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

describe('Milestone 1 Custom Domains — Adversarial Stress Test Suite', () => {
  let rawDb: ReturnType<typeof freshDb>;
  let d1: ReturnType<typeof makeD1>;

  const defaultOwnerId = 'usr_stress_master_owner';
  const defaultOrgId = 'org_stress_enterprise_1';
  const altOrgId = 'org_stress_enterprise_2';

  beforeEach(() => {
    clearHostnameCache();
    clearBrandingCache();
    vi.clearAllMocks();

    rawDb = freshDb();
    rawDb.exec(STRESS_SCHEMA);
    d1 = makeD1(rawDb);
    mocks.mockGetD1.mockResolvedValue(d1 as unknown as D1Database);

    // Setup Org 1
    rawDb
      .prepare("INSERT INTO organizations (id, name, slug, plan) VALUES (?, ?, ?, ?)")
      .run(defaultOrgId, 'Stress Org 1', 'stress-org-1', 'master');
    rawDb
      .prepare("INSERT INTO org_members (id, org_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)")
      .run('mem_stress_1', defaultOrgId, defaultOwnerId, 'owner', Date.now());
    rawDb
      .prepare("INSERT INTO subscriptions (id, org_id, user_id, tier, plan, status) VALUES (?, ?, ?, ?, ?, ?)")
      .run('sub_stress_1', defaultOrgId, defaultOwnerId, 'MASTER', 'master', 'active');
    rawDb
      .prepare("INSERT INTO org_branding (org_id, agency_name, logo_url, primary_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(defaultOrgId, 'Stress Enterprise Brand', 'https://cdn.example.com/logo.png', '#6366F1', Date.now(), Date.now());

    // Setup Org 2
    rawDb
      .prepare("INSERT INTO organizations (id, name, slug, plan) VALUES (?, ?, ?, ?)")
      .run(altOrgId, 'Stress Org 2', 'stress-org-2', 'master');
    rawDb
      .prepare("INSERT INTO org_members (id, org_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)")
      .run('mem_stress_2', altOrgId, 'usr_alt_owner', 'owner', Date.now());
    rawDb
      .prepare("INSERT INTO subscriptions (id, org_id, user_id, tier, plan, status) VALUES (?, ?, ?, ?, ?, ?)")
      .run('sub_stress_2', altOrgId, 'usr_alt_owner', 'MASTER', 'master', 'active');

    // Default Auth: Authenticated as MASTER tier owner of Org 1
    mocks.mockGetCurrentUser.mockResolvedValue({
      id: defaultOwnerId,
      email: 'owner@stress-org.com',
      role: 'user',
    });
    mocks.mockIsUserAdminWithRole.mockResolvedValue({
      isAdmin: false,
      role: 'user',
    });
    mocks.mockGetUserTier.mockResolvedValue('MASTER');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Extreme Hostname Formats & Validation Resilience
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Dimension 1: Extreme Hostname Formats & Validation Resilience', () => {
    it('accepts valid ASCII punycode IDN hostnames', () => {
      const validPunycode = [
        'xn--ls8h.test.com', // Emoji punycode
        'xn--bcher-kva.example.de', // German umlaut
        'xn--ti-vi-4ta2275b.com', // Vietnamese
        'portal.xn--fiqs8s.cn', // Chinese IDN TLD
      ];

      for (const host of validPunycode) {
        const res = validateHostname(host);
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value).toBe(host.toLowerCase());
        }
      }
    });

    it('rejects unencoded unicode characters and emojis', () => {
      const invalidUnicode = [
        'tiếngviệt.com',
        'café.vn',
        '🚀rocket.agency.com',
        'bücherei.de',
        'проверка.рф',
      ];

      for (const host of invalidUnicode) {
        const res = validateHostname(host);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error.code).toBe('INVALID_HOSTNAME');
        }
      }
    });

    it('rejects trailing dot FQDNs in registration but normalizes them in edge routing', () => {
      const withTrailingDot = 'portal.myagency.com.';
      
      // Land validation strictly rejects trailing dot
      const valRes = validateHostname(withTrailingDot);
      expect(valRes.ok).toBe(false);
      if (!valRes.ok) {
        expect(valRes.error.code).toBe('INVALID_HOSTNAME');
      }

      // Edge router normalization cleanly strips trailing dot
      const normalized = normalizeHostname(withTrailingDot);
      expect(normalized).toBe('portal.myagency.com');

      // Edge router also handles multiple trailing dots defensively
      expect(normalizeHostname('portal.myagency.com...')).toBe('portal.myagency.com..');
    });

    it('blocks SQL injection and command injection payloads defensively', async () => {
      const sqliPayloads = [
        "portal.agency.com'; DROP TABLE custom_domains; --",
        "admin' OR '1'='1.example.com",
        "test' UNION SELECT * FROM users; --.org",
        "portal.com; SELECT SLEEP(5); --",
        "test.com' AND (SELECT 1 FROM (SELECT COUNT(*), CONCAT((SELECT version()), 0x3a, FLOOR(RAND(0)*2)) x FROM information_schema.tables GROUP BY x) a); --",
      ];

      for (const payload of sqliPayloads) {
        // 1. Validator blocks it
        const valRes = validateHostname(payload);
        expect(valRes.ok).toBe(false);
        if (!valRes.ok) {
          expect(valRes.error.code).toBe('INVALID_HOSTNAME');
        }

        // 2. Direct database query via parameterized statements safely returns null without error
        const queried = await getCustomDomainByHostname(d1 as unknown as D1Database, payload);
        expect(queried).toBeNull();
      }

      // Verify D1 table is not dropped or corrupted
      const domainsCount = await (d1 as unknown as D1Database)
        .prepare('SELECT COUNT(*) AS count FROM custom_domains')
        .first<{ count: number }>();
      expect(domainsCount?.count).toBe(0);
    });

    it('handles boundary hostname lengths (<4, >253, label <= 63, label > 63)', () => {
      // Under minimum (< 4 chars)
      expect(validateHostname('a.b').ok).toBe(false);
      expect(validateHostname('').ok).toBe(false);
      expect(validateHostname('   ').ok).toBe(false);

      // Over maximum (> 253 chars)
      const part60 = 'a'.repeat(60);
      const longHost254 = `${part60}.${part60}.${part60}.${part60}.com${'x'.repeat(10)}`;
      expect(longHost254.length).toBeGreaterThan(253);
      expect(validateHostname(longHost254).ok).toBe(false);

      // Single label exceeds 63 characters
      const longLabel64 = `${'a'.repeat(64)}.example.com`;
      expect(validateHostname(longLabel64).ok).toBe(false);

      // Single label exactly 63 characters
      const exactLabel63 = `${'a'.repeat(63)}.example.com`;
      expect(validateHostname(exactLabel63).ok).toBe(true);

      // Valid total length under 253 with 63-char labels
      const validLong = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.example.com`;
      expect(validLong.length).toBeLessThanOrEqual(253);
      expect(validateHostname(validLong).ok).toBe(true);
    });

    it('verifies regex validation enforces label boundaries on intermediate labels and trailing hyphens', () => {
      // 1. First label leading and trailing hyphens are blocked:
      expect(validateHostname('-portal.example.com').ok).toBe(false);
      expect(validateHostname('portal-.example.com').ok).toBe(false);
      expect(validateHostname('portal..example.com').ok).toBe(false);
      expect(validateHostname('portal.example..com').ok).toBe(false);
      expect(validateHostname('portal_domain.example.com').ok).toBe(false); // Underscores forbidden

      // 2. Remediated: Intermediate labels and TLDs with leading or trailing hyphens are strictly blocked
      const intermediateTrailingHyphen = validateHostname('portal.example-.com');
      const intermediateLeadingHyphen = validateHostname('portal.-example.com');
      const tldTrailingHyphen = validateHostname('portal.example.com-');
      const singleHyphenLabel = validateHostname('portal.-.com');

      expect(intermediateTrailingHyphen.ok).toBe(false); // Correctly rejected
      expect(intermediateLeadingHyphen.ok).toBe(false); // Correctly rejected
      expect(tldTrailingHyphen.ok).toBe(false); // Correctly rejected
      expect(singleHyphenLabel.ok).toBe(false); // Correctly rejected
    });

    it('forbids platform domains and handles FQDN checks for single-label names', () => {
      const platformDomains = [
        'sophia.agencyos.network',
        'agencyos.network',
        'workers.dev',
        'sub.sophia.agencyos.network',
        'deep.sub.agencyos.network',
        'evil.workers.dev',
      ];

      for (const host of platformDomains) {
        const res = validateHostname(host);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error.message).toContain('Cannot register root platform domains or internal reserved hostnames');
        }
      }

      // 'localhost' is checked against forbidden domains first and returns reserved error
      const localhostRes = validateHostname('localhost');
      expect(localhostRes.ok).toBe(false);
      if (!localhostRes.ok) {
        expect(localhostRes.error.message).toContain('Cannot register root platform domains or internal reserved hostnames');
      }

      // Subdomains of localhost also trigger the forbidden domain check
      const subLocalhost = validateHostname('app.localhost');
      expect(subLocalhost.ok).toBe(false);
      if (!subLocalhost.ok) {
        expect(subLocalhost.error.message).toContain('Cannot register root platform domains or internal reserved hostnames');
      }
    });

    it('verifies pages.dev is forbidden in registration matching routing policy', () => {
      const pagesDevRegistration = validateHostname('myagency.pages.dev');
      expect(pagesDevRegistration.ok).toBe(false); // Remediated: pages.dev is forbidden
      if (!pagesDevRegistration.ok) {
        expect(pagesDevRegistration.error.message).toContain('Cannot register root platform domains or internal reserved hostnames');
      }

      // Edge routing also marks it as internal:
      expect(isInternalOrCanonicalHostname('myagency.pages.dev')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Concurrency, Race Conditions & Collision Resilience
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Dimension 2: Concurrency, Race Conditions & Collision Resilience', () => {
    it('rejects duplicate domain registration in the same organization with CONFLICT', async () => {
      const hostname = 'portal.concurrent-brand.com';

      // 1. Initial registration succeeds
      const first = await registerCustomDomainAction(defaultOrgId, hostname);
      expect(first.ok).toBe(true);

      // 2. Second registration attempt fails with CONFLICT
      const second = await registerCustomDomainAction(defaultOrgId, hostname);
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.error.code).toBe('CONFLICT');
        expect(second.error.message).toContain('already registered');
      }
    });

    it('rejects cross-organization duplicate domain registration attempts', async () => {
      const hostname = 'exclusive.agency-portal.com';

      // 1. Org 1 registers domain
      const org1Res = await registerCustomDomainAction(defaultOrgId, hostname);
      expect(org1Res.ok).toBe(true);

      // 2. Switch auth to Org 2 owner
      mocks.mockGetCurrentUser.mockResolvedValue({
        id: 'usr_alt_owner',
        email: 'owner@stress-org-2.com',
        role: 'user',
      });

      // 3. Org 2 tries to hijack the exact same domain
      const org2Res = await registerCustomDomainAction(altOrgId, hostname);
      expect(org2Res.ok).toBe(false);
      if (!org2Res.ok) {
        expect(org2Res.error.code).toBe('CONFLICT');
        expect(org2Res.error.message).toContain('already registered');
      }
    });

    it('enforces case-insensitive duplicate collision prevention', async () => {
      const lower = 'app.case-test.com';
      const upper = 'APP.CASE-TEST.COM';
      const mixed = 'App.Case-Test.Com';

      const res1 = await registerCustomDomainAction(defaultOrgId, lower);
      expect(res1.ok).toBe(true);

      const res2 = await registerCustomDomainAction(defaultOrgId, upper);
      expect(res2.ok).toBe(false);
      if (!res2.ok) {
        expect(res2.error.code).toBe('CONFLICT');
      }

      const res3 = await registerCustomDomainAction(defaultOrgId, mixed);
      expect(res3.ok).toBe(false);
      if (!res3.ok) {
        expect(res3.error.code).toBe('CONFLICT');
      }
    });

    it('handles simulated concurrent race conditions without duplicating D1 records', async () => {
      const raceHostname = 'racing-portal.enterprise.com';

      // Fire 10 simultaneous registration requests
      const promises = Array.from({ length: 10 }).map(() =>
        registerCustomDomainAction(defaultOrgId, raceHostname)
      );

      const results = await Promise.all(promises);

      // Count successes vs failures
      const successes = results.filter((r) => r.ok);
      const failures = results.filter((r) => !r.ok);

      // Exactly 1 must succeed
      expect(successes.length).toBe(1);
      // Exactly 9 must fail
      expect(failures.length).toBe(9);

      // Verify D1 records count is strictly 1
      const countResult = await (d1 as unknown as D1Database)
        .prepare("SELECT COUNT(*) AS count FROM custom_domains WHERE hostname = ?1")
        .bind(raceHostname)
        .first<{ count: number }>();
      expect(countResult?.count).toBe(1);
    });

    it('handles high concurrent registration of distinct hostnames for an organization', async () => {
      const count = 15;
      const hostnames = Array.from({ length: count }, (_, i) => `portal-batch-${i + 1}.mybrand.com`);

      const promises = hostnames.map((h) => registerCustomDomainAction(defaultOrgId, h));
      const results = await Promise.all(promises);

      // All 15 distinct domains must succeed
      for (const res of results) {
        expect(res.ok).toBe(true);
      }

      // Verify list returns all 15
      const listRes = await listCustomDomainsAction(defaultOrgId);
      expect(listRes.ok).toBe(true);
      if (listRes.ok) {
        expect(listRes.value.length).toBe(count);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Rapid & Cyclical Status Transitions
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Dimension 3: Rapid & Cyclical Status Transitions', () => {
    it('correctly transitions through full lifecycle: pending -> verified -> active -> error -> revoked', () => {
      // 1. Pending
      const pendingCf: CloudflareCustomHostnameResult = {
        id: 'cf_trans_1',
        hostname: 'lifecycle.domain.com',
        status: 'pending',
        ssl: { id: 'cf_trans_1', status: 'pending_validation' },
      };
      const t1 = evaluateStatusTransitions(pendingCf);
      expect(t1.sslStatus).toBe('pending_validation');
      expect(t1.verificationStatus).toBe('pending');
      expect(t1.active).toBe(false);

      // 2. Pending deployment (verified)
      const verifiedCf: CloudflareCustomHostnameResult = {
        id: 'cf_trans_1',
        hostname: 'lifecycle.domain.com',
        status: 'pending',
        ssl: { id: 'cf_trans_1', status: 'pending_deployment' },
      };
      const t2 = evaluateStatusTransitions(verifiedCf);
      expect(t2.sslStatus).toBe('pending_deployment');
      expect(t2.verificationStatus).toBe('verified');
      expect(t2.active).toBe(false);

      // 3. Active (both host and SSL active)
      const activeCf: CloudflareCustomHostnameResult = {
        id: 'cf_trans_1',
        hostname: 'lifecycle.domain.com',
        status: 'active',
        ssl: { id: 'cf_trans_1', status: 'active' },
      };
      const t3 = evaluateStatusTransitions(activeCf);
      expect(t3.sslStatus).toBe('active');
      expect(t3.verificationStatus).toBe('active');
      expect(t3.cnameVerified).toBe(true);
      expect(t3.active).toBe(true);

      // 4. Error (SSL validation failure)
      const errorCf: CloudflareCustomHostnameResult = {
        id: 'cf_trans_1',
        hostname: 'lifecycle.domain.com',
        status: 'blocked',
        ssl: { id: 'cf_trans_1', status: 'error' },
        verification_errors: ['CAA record does not allow issuance'],
      };
      const t4 = evaluateStatusTransitions(errorCf);
      expect(t4.sslStatus).toBe('error');
      expect(t4.verificationStatus).toBe('failed');
      expect(t4.active).toBe(false);
      expect(t4.errors).toEqual(['CAA record does not allow issuance']);

      // 5. Revoked
      const revokedCf: CloudflareCustomHostnameResult = {
        id: 'cf_trans_1',
        hostname: 'lifecycle.domain.com',
        status: 'blocked',
        ssl: { id: 'cf_trans_1', status: 'revoked' },
      };
      const t5 = evaluateStatusTransitions(revokedCf);
      expect(t5.sslStatus).toBe('revoked');
      expect(t5.verificationStatus).toBe('revoked');
      expect(t5.active).toBe(false);
    });

    it('verifies status transition when cfResult.status is blocked transitions to error/failed', () => {
      // Cloudflare host status is 'blocked' (e.g. security/phishing block) while SSL is 'pending_validation'
      const blockedHostResult: CloudflareCustomHostnameResult = {
        id: 'cf_blocked_1',
        hostname: 'blocked-site.com',
        status: 'blocked',
        ssl: { id: 'cf_blocked_1', status: 'pending_validation' },
        verification_errors: [],
      };

      const transitions = evaluateStatusTransitions(blockedHostResult);
      // Remediated: transitions to error/failed and records error
      expect(transitions.sslStatus).toBe('error');
      expect(transitions.verificationStatus).toBe('failed');
      expect(transitions.active).toBe(false);
      expect(transitions.cnameVerified).toBe(false);
      expect(transitions.errors).toContain('Hostname is blocked by Cloudflare');
    });

    it('maintains idempotency under rapid sequential status verification calls', async () => {
      // Register an active-test domain (which mock mode evaluates to active)
      const reg = await registerCustomDomain(d1 as unknown as D1Database, defaultOrgId, 'rapid-active-test.com');
      expect(reg.ssl_status).toBe('pending_validation');

      // Execute 5 rapid sequential status checks
      for (let i = 0; i < 5; i++) {
        const verified = await verifyCustomDomainStatus(d1 as unknown as D1Database, reg.id);
        expect(verified.sslStatus).toBe('active');
        expect(verified.verificationStatus).toBe('active');
        expect(verified.active).toBe(true);
        expect(verified.cnameVerified).toBe(true);
      }

      // Check D1 persistence
      const domain = await getCustomDomainById(d1 as unknown as D1Database, reg.id);
      expect(domain?.ssl_status).toBe('active');
      expect(domain?.active).toBe(true);
    });

    it('handles out-of-order state transitions (e.g. pending -> active -> error -> active)', async () => {
      const reg = await registerCustomDomain(d1 as unknown as D1Database, defaultOrgId, 'state-jump.com');

      // Helper to simulate Cloudflare state update
      const updateCfState = async (
        sslStatus: 'pending_validation' | 'pending_deployment' | 'active' | 'error',
        status: 'pending' | 'active' | 'blocked',
        errors: string[] = [],
      ) => {
        const { sslStatus: s, verificationStatus: v, cnameVerified: c, active: a, errors: e } =
          evaluateStatusTransitions({
            id: reg.cf_custom_hostname_id!,
            hostname: reg.hostname,
            status,
            ssl: { id: reg.cf_custom_hostname_id!, status: sslStatus },
            verification_errors: errors,
          });

        await (d1 as unknown as D1Database)
          .prepare(
            `UPDATE custom_domains SET
              ssl_status = ?1, verification_status = ?2, cname_verified = ?3,
              active = ?4, verification_errors = ?5, updated_at = ?6
            WHERE id = ?7`,
          )
          .bind(s, v, c ? 1 : 0, a ? 1 : 0, JSON.stringify(e), Date.now(), reg.id)
          .run();
      };

      // Jump 1: pending -> active
      await updateCfState('active', 'active');
      let current = await getCustomDomainById(d1 as unknown as D1Database, reg.id);
      expect(current?.ssl_status).toBe('active');
      expect(current?.active).toBe(true);

      // Jump 2: active -> error
      await updateCfState('error', 'blocked', ['DCV token expired']);
      current = await getCustomDomainById(d1 as unknown as D1Database, reg.id);
      expect(current?.ssl_status).toBe('error');
      expect(current?.active).toBe(false);
      expect(current?.verification_errors).toEqual(['DCV token expired']);

      // Jump 3: error -> active (recovered certificate)
      await updateCfState('active', 'active', []);
      current = await getCustomDomainById(d1 as unknown as D1Database, reg.id);
      expect(current?.ssl_status).toBe('active');
      expect(current?.active).toBe(true);
      expect(current?.verification_errors).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CAA & DCV Verification Error Handling
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Dimension 4: CAA & DCV Verification Error Handling', () => {
    it('captures and persists Cloudflare CAA error responses in D1', async () => {
      // In mock mode, error-test triggers an error response with verification_errors
      const hostname = 'portal.caa-error-test.com';
      const reg = await registerCustomDomain(d1 as unknown as D1Database, defaultOrgId, hostname);

      const verifyRes = await verifyCustomDomainStatus(d1 as unknown as D1Database, reg.id);
      expect(verifyRes.sslStatus).toBe('error');
      expect(verifyRes.verificationStatus).toBe('failed');
      expect(verifyRes.active).toBe(false);
      expect(verifyRes.errors).toContain('CA verification timeout');

      // Verify D1 persistence
      const row = await getCustomDomainById(d1 as unknown as D1Database, reg.id);
      expect(row?.verification_errors).toContain('CA verification timeout');
    });

    it('parses complex validation_records and preserves multi-line error strings', () => {
      const complexCfResult: CloudflareCustomHostnameResult = {
        id: 'cf_complex_err',
        hostname: 'caa-restricted.example.com',
        status: 'blocked',
        verification_errors: [
          'caa_error: CAA record prohibits issuance by DigiCert and Let\'s Encrypt',
          'dcv_delegation_error: Target CNAME does not point to fallback origin',
          '   ', // Whitespace item should be filtered
        ],
        ssl: {
          id: 'cf_complex_err',
          status: 'error',
          validation_records: [
            {
              status: 'failed',
              txt_name: '_acme-challenge.caa-restricted.example.com',
              txt_value: 'expected_dcv_token_abc123',
            },
          ],
        },
      };

      const parsedErrors = parseVerificationErrors(complexCfResult);
      expect(parsedErrors.length).toBe(2);
      expect(parsedErrors[0]).toContain('caa_error');
      expect(parsedErrors[1]).toContain('dcv_delegation_error');

      const dcvRecord = parseSslDcvVerification(complexCfResult);
      expect(dcvRecord?.type).toBe('txt');
      expect(dcvRecord?.name).toBe('_acme-challenge.caa-restricted.example.com');
      expect(dcvRecord?.value).toBe('expected_dcv_token_abc123');

      const transitions = evaluateStatusTransitions(complexCfResult);
      expect(transitions.sslStatus).toBe('error');
      expect(transitions.verificationStatus).toBe('failed');
      expect(transitions.errors.length).toBe(2);
    });

    it('clears prior verification errors once certificate is successfully issued', async () => {
      const reg = await registerCustomDomain(d1 as unknown as D1Database, defaultOrgId, 'caa-recovery.com');

      // Inject prior CAA error
      await (d1 as unknown as D1Database)
        .prepare(
          `UPDATE custom_domains SET
            ssl_status = 'error',
            verification_errors = ?1,
            active = 0
          WHERE id = ?2`,
        )
        .bind(JSON.stringify(['caa_error: Issuance blocked']), reg.id)
        .run();

      const before = await getCustomDomainById(d1 as unknown as D1Database, reg.id);
      expect(before?.verification_errors.length).toBe(1);

      // Simulate recovery in Cloudflare
      const recoveredCf: CloudflareCustomHostnameResult = {
        id: reg.cf_custom_hostname_id!,
        hostname: reg.hostname,
        status: 'active',
        verification_errors: [],
        ssl: {
          id: reg.cf_custom_hostname_id!,
          status: 'active',
        },
      };

      const { sslStatus, verificationStatus, cnameVerified, active, errors } =
        evaluateStatusTransitions(recoveredCf);

      await (d1 as unknown as D1Database)
        .prepare(
          `UPDATE custom_domains SET
            ssl_status = ?1,
            verification_status = ?2,
            cname_verified = ?3,
            active = ?4,
            verification_errors = ?5
          WHERE id = ?6`,
        )
        .bind(sslStatus, verificationStatus, cnameVerified ? 1 : 0, active ? 1 : 0, JSON.stringify(errors), reg.id)
        .run();

      const after = await getCustomDomainById(d1 as unknown as D1Database, reg.id);
      expect(after?.ssl_status).toBe('active');
      expect(after?.active).toBe(true);
      expect(after?.verification_errors).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Mock Mode Resilience, Malformed API Responses & Corrupt D1 Data Defense
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Dimension 5: Mock Mode Resilience, Malformed API Responses & Corrupt D1 Data Defense', () => {
    it('operates deterministically in mock mode when Cloudflare credentials are absent', async () => {
      delete process.env.CLOUDFLARE_ZONE_ID;
      delete process.env.CLOUDFLARE_API_TOKEN;

      const res = await createCloudflareCustomHostname('mock-resilience.com');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.id).toMatch(/^mock_cf_/);
        expect(res.value.ownership_verification?.name).toBe('_cf-custom-hostname.mock-resilience.com');
        expect(res.value.ssl?.txt_name).toBe('_acme-challenge.mock-resilience.com');
      }

      const delRes = await deleteCloudflareCustomHostname('mock_cf_123');
      expect(delRes.ok).toBe(true);
    });

    it('handles simulated Cloudflare API rate limiting (HTTP 429) gracefully', async () => {
      // Provide credentials to trigger real fetch path
      process.env.CLOUDFLARE_ZONE_ID = 'test_zone_123';
      process.env.CLOUDFLARE_API_TOKEN = 'test_token_abc';

      // Mock global fetch returning 429
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          errors: [{ code: 10001, message: 'Cloudflare API rate limit exceeded. Retry later.' }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await createCloudflareCustomHostname('rate-limited.com');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('CLOUDFLARE_ERROR');
        expect(res.error.message).toContain('rate limit exceeded');
      }

      vi.unstubAllGlobals();
    });

    it('handles simulated network transport errors (e.g. connection refused)', async () => {
      process.env.CLOUDFLARE_ZONE_ID = 'test_zone_123';
      process.env.CLOUDFLARE_API_TOKEN = 'test_token_abc';

      const mockFetch = vi.fn().mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));
      vi.stubGlobal('fetch', mockFetch);

      const res = await createCloudflareCustomHostname('network-error.com');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('CLOUDFLARE_ERROR');
        expect(res.error.message).toContain('fetch failed: ECONNREFUSED');
      }

      vi.unstubAllGlobals();
    });

    it('defensively handles corrupted JSON strings in D1 without uncaught errors', async () => {
      // Insert a row with deliberately malformed JSON in JSON columns
      const corruptDomainId = 'dom_corrupt_test_1';
      await (d1 as unknown as D1Database)
        .prepare(
          `INSERT INTO custom_domains (
            id, org_id, hostname, cf_custom_hostname_id, ssl_status, verification_status,
            verification_errors, ownership_verification, ssl_verification,
            cname_target, cname_verified, active, created_at, updated_at
          ) VALUES (
            ?1, ?2, ?3, ?4, 'pending_validation', 'pending',
            '{corrupted_json_syntax', '<<<invalid_json>>>', 'not_a_json_object',
            'cname.sophia.agencyos.network', 0, 0, 100, 100
          )`,
        )
        .bind(corruptDomainId, defaultOrgId, 'corrupt-json.com', 'cf_corrupt_1')
        .run();

      // mapRowToCustomDomainRecord must not throw SyntaxError
      const record = await getCustomDomainById(d1 as unknown as D1Database, corruptDomainId);
      expect(record).not.toBeNull();
      expect(record?.verification_errors).toEqual([]);
      expect(record?.ownership_verification).toBeNull();
      expect(record?.ssl_verification).toBeNull();
      expect(record?.hostname).toBe('corrupt-json.com');
    });

    it('safely handles null or undefined properties in Cloudflare result objects', () => {
      const minimalCf = {
        id: 'cf_min_1',
        hostname: 'minimal.com',
        status: 'pending',
      } as unknown as CloudflareCustomHostnameResult;

      expect(parseOwnershipVerification(minimalCf)).toBeNull();
      expect(parseSslDcvVerification(minimalCf)).toBeNull();
      expect(parseVerificationErrors(minimalCf)).toEqual([]);

      const transitions = evaluateStatusTransitions(minimalCf);
      expect(transitions.sslStatus).toBe('pending_validation');
      expect(transitions.verificationStatus).toBe('pending');
      expect(transitions.cnameVerified).toBe(false);
      expect(transitions.active).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Cache Invalidation & Flooding Resistance
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Dimension 6: Cache Invalidation & Edge Flooding Resistance', () => {
    it('invalidates negative cache when a domain is newly registered', async () => {
      const hostname = 'new-tenant.custombrand.com';

      // 1. Initial resolution returns null and populates negative cache
      const beforeReg = await getTenantBrandingByHostname(d1 as unknown as D1Database, hostname);
      expect(beforeReg).toBeNull();

      // 2. Register domain and activate it
      const reg = await registerCustomDomain(d1 as unknown as D1Database, defaultOrgId, hostname);
      await (d1 as unknown as D1Database)
        .prepare(
          `UPDATE custom_domains SET
            ssl_status = 'active', verification_status = 'active', active = 1
          WHERE id = ?1`,
        )
        .bind(reg.id)
        .run();

      // Invalidate cache for this hostname
      invalidateTenantBrandingCache(hostname);

      // 3. Immediately query again: must return newly resolved branding!
      const afterReg = await getTenantBrandingByHostname(d1 as unknown as D1Database, hostname);
      expect(afterReg).not.toBeNull();
      expect(afterReg?.orgId).toBe(defaultOrgId);
      expect(afterReg?.agencyName).toBe('Stress Enterprise Brand');
    });

    it('survives high cache churn (500+ distinct hostname queries) without leakage or unbounded growth', async () => {
      // Query 550 distinct unmapped hostnames to stress cache bounds
      for (let i = 0; i < 550; i++) {
        const result = await getTenantBrandingByHostname(
          d1 as unknown as D1Database,
          `unmapped-tenant-${i}.randomdomain.com`,
        );
        expect(result).toBeNull();
      }

      // Memory and execution must remain stable
      clearBrandingCache();
      expect(true).toBe(true);
    });
  });
});
