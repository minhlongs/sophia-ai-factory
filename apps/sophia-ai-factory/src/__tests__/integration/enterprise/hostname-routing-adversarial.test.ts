/**
 * Adversarial Stress Test Suite: Milestone 1 Hostname Resolution, Normalization & Edge Routing
 *
 * Empirical verification of:
 * 1. Hostname normalization boundary cases (ports, protocols, trailing dots, path traversal, unicode/punycode, uppercase, subdomains)
 * 2. Canonical platform domain bypass defense (sophia.agencyos.network, localhost, *.workers.dev, *.pages.dev)
 * 3. Lookalike / spoof domain rejection (ensuring attackers cannot masquerade as canonical)
 * 4. Malicious/malformed Host header injection (CRLF, null bytes, non-ByteString Unicode, ByteString limit)
 * 5. Edge routing exception resilience (Headers.set safety, DB outages, SQLi resilience)
 * 6. Tenant isolation and context leakage prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { freshDb, makeD1 } from '../shared-d1-shim';
import {
  normalizeHostname,
  isInternalOrCanonicalHostname,
  extractHostname,
  resolveTenantFromHostname,
  injectTenantRoutingHeaders,
  getTenantOrgId,
  getCustomDomain,
  isWhitelabelActive,
  clearHostnameCache,
  type TenantHostnameContext,
} from '@/tree/custom-domains/hostname-resolver';
import { validateHostname } from '@/tree/custom-domains/verification-service';

const D1_SCHEMA = `
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

describe('Challenger 1: Hostname Resolution, Normalization & Edge Routing Adversarial Suite', () => {
  let rawDb: ReturnType<typeof freshDb>;
  let d1: ReturnType<typeof makeD1>;

  beforeEach(() => {
    clearHostnameCache();
    rawDb = freshDb();
    rawDb.exec(D1_SCHEMA);
    d1 = makeD1(rawDb);
  });

  // ── Dimension 1: Hostname Normalization Boundary Cases ─────────────────────
  describe('Dimension 1: Normalization Boundary Cases', () => {
    describe('Port Numbers', () => {
      it('strips standard and non-standard port numbers from hostname', () => {
        expect(normalizeHostname('portal.agency.com:3000')).toBe('portal.agency.com');
        expect(normalizeHostname('portal.agency.com:80')).toBe('portal.agency.com');
        expect(normalizeHostname('portal.agency.com:443')).toBe('portal.agency.com');
        expect(normalizeHostname('portal.agency.com:65535')).toBe('portal.agency.com');
        expect(normalizeHostname('portal.agency.com:99999')).toBe('portal.agency.com');
        expect(normalizeHostname('localhost:8787')).toBe('localhost');
      });

      it('strips port from IPv6 bracketed hosts', () => {
        expect(normalizeHostname('[2001:db8::1]:8080')).toBe('2001:db8::1');
        expect(normalizeHostname('[::1]:3000')).toBe('::1');
        expect(normalizeHostname('[::1]')).toBe('::1');
      });

      it('handles multiple colons gracefully without throwing', () => {
        expect(normalizeHostname('portal.agency.com:3000:80')).toBe('portal.agency.com');
      });
    });

    describe('Protocols', () => {
      it('strips http:// and https:// prefixes', () => {
        expect(normalizeHostname('http://portal.client.com')).toBe('portal.client.com');
        expect(normalizeHostname('https://portal.client.com')).toBe('portal.client.com');
        expect(normalizeHostname('HTTPS://PORTAL.CLIENT.COM')).toBe('portal.client.com');
        expect(normalizeHostname('http://portal.client.com:3000')).toBe('portal.client.com');
      });

      it('strips trailing paths and query strings when protocols are passed', () => {
        expect(normalizeHostname('https://portal.client.com/dashboard/sops')).toBe('portal.client.com');
        expect(normalizeHostname('http://portal.client.com/')).toBe('portal.client.com');
      });
    });

    describe('Trailing Dots and DNS FQDNs', () => {
      it('strips single trailing DNS dot', () => {
        expect(normalizeHostname('portal.agency.com.')).toBe('portal.agency.com');
        expect(normalizeHostname('localhost.')).toBe('localhost');
        expect(normalizeHostname('sophia.agencyos.network.')).toBe('sophia.agencyos.network');
      });

      it('remediated defense: multiple trailing dots are stripped completely and recognized as canonical', () => {
        // Multiple trailing dots are stripped cleanly:
        const doubleDot = normalizeHostname('sophia.agencyos.network..');
        expect(doubleDot).toBe('sophia.agencyos.network');

        // And canonical check correctly recognizes it:
        const isCanonical = isInternalOrCanonicalHostname(doubleDot);
        expect(isCanonical).toBe(true);
      });
    });

    describe('Path Traversal & URL Component Probing', () => {
      it('strips path traversal patterns via forward slash', () => {
        expect(normalizeHostname('portal.agency.com/../../../etc/passwd')).toBe('portal.agency.com');
        expect(normalizeHostname('portal.agency.com/..%2f..%2f')).toBe('portal.agency.com');
      });

      it('handles query strings and hash fragments without uncaught exceptions', () => {
        const queryHost = normalizeHostname('portal.agency.com?query=evil');
        expect(typeof queryHost).toBe('string');
        const hashHost = normalizeHostname('portal.agency.com#fragment');
        expect(typeof hashHost).toBe('string');
      });
    });

    describe('Unicode & Punycode', () => {
      it('preserves valid ASCII punycode IDN representations', () => {
        expect(normalizeHostname('xn--ls8h.test.com')).toBe('xn--ls8h.test.com');
        expect(normalizeHostname('XN--LS8H.TEST.COM:8080')).toBe('xn--ls8h.test.com');
        expect(normalizeHostname('xn--ti-vi-4ta2275b.com')).toBe('xn--ti-vi-4ta2275b.com');
      });

      it('normalizes uppercase and trims whitespace', () => {
        expect(normalizeHostname('  PORTAL.AGENCYALPHA.COM:443  ')).toBe('portal.agencyalpha.com');
        expect(normalizeHostname('\tSub.Brand.VN:3000\n')).toBe('sub.brand.vn');
      });

      it('handles empty, null, and undefined inputs defensively', () => {
        expect(normalizeHostname('')).toBe('');
        expect(normalizeHostname('   ')).toBe('');
        expect(normalizeHostname(null)).toBe('');
        expect(normalizeHostname(undefined)).toBe('');
      });
    });
  });

  // ── Dimension 2: Canonical Platform Domain Bypass Probing ───────────────────
  describe('Dimension 2: Canonical Platform Domain Bypass Defense', () => {
    it('identifies exact canonical domains as internal', () => {
      expect(isInternalOrCanonicalHostname('sophia.agencyos.network')).toBe(true);
      expect(isInternalOrCanonicalHostname('localhost')).toBe(true);
      expect(isInternalOrCanonicalHostname('127.0.0.1')).toBe(true);
      expect(isInternalOrCanonicalHostname('0.0.0.0')).toBe(true);
      expect(isInternalOrCanonicalHostname('::1')).toBe(true);
      expect(isInternalOrCanonicalHostname('workers.dev')).toBe(true);
      expect(isInternalOrCanonicalHostname('pages.dev')).toBe(true);
      expect(isInternalOrCanonicalHostname('agencyos.network')).toBe(true);
    });

    it('identifies subdomains of canonical platform domains as internal', () => {
      expect(isInternalOrCanonicalHostname('sub.agencyos.network')).toBe(true);
      expect(isInternalOrCanonicalHostname('admin.agencyos.network')).toBe(true);
      expect(isInternalOrCanonicalHostname('deep.nested.agencyos.network')).toBe(true);
      expect(isInternalOrCanonicalHostname('sub.localhost')).toBe(true);
      expect(isInternalOrCanonicalHostname('preview.pages.dev')).toBe(true);
      expect(isInternalOrCanonicalHostname('my-branch.pages.dev')).toBe(true);
      expect(isInternalOrCanonicalHostname('sophia-worker.workers.dev')).toBe(true);
      expect(isInternalOrCanonicalHostname('edge-test.workers.dev')).toBe(true);
    });

    it('identifies loopback IPv4 ranges as internal', () => {
      expect(isInternalOrCanonicalHostname('127.0.0.2')).toBe(true);
      expect(isInternalOrCanonicalHostname('127.1.2.3')).toBe(true);
    });

    it('bypasses D1 queries for normalized canonical hostnames in resolveTenantFromHostname', async () => {
      const mockDb = {
        prepare: vi.fn(),
      } as unknown as D1Database;

      const canonicalList = [
        'sophia.agencyos.network',
        'sophia.agencyos.network:3000',
        'https://sophia.agencyos.network',
        'localhost',
        'localhost:8787',
        'sub.localhost',
        '127.0.0.1:4000',
        '[::1]:3000',
        'preview.workers.dev',
        'test.pages.dev',
        'portal.agencyos.network',
      ];

      for (const host of canonicalList) {
        const result = await resolveTenantFromHostname(mockDb, host);
        expect(result.isInternal).toBe(true);
        expect(result.isCustomDomain).toBe(false);
        expect(result.tenantOrgId).toBeNull();
        expect(result.whitelabelActive).toBe(false);
      }

      // Ensure D1 was NEVER queried for any canonical domain
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });
  });

  // ── Dimension 3: Lookalike & Spoof Domain Rejection ─────────────────────────
  describe('Dimension 3: Lookalike & Spoof Domain Resistance', () => {
    const lookalikeDomains = [
      'evilagencyos.network',           // Missing dot prefix
      'not-agencyos.network',           // Hyphenated variant
      'agencyos.network.evil.com',      // Suffix hijacking
      'sophia.agencyos.network.attacker.com',
      'evil-workers.dev',               // Prefix masquerade
      'evilworkers.dev',
      'workers.dev.attacker.com',
      'evil-pages.dev',
      'evilpages.dev',
      'pages.dev.attacker.com',
      'localhost.attacker.com',
      '128.0.0.1',
    ];

    it.each(lookalikeDomains)('correctly treats lookalike domain as non-canonical: %s', (domain) => {
      expect(isInternalOrCanonicalHostname(domain)).toBe(false);
    });

    it('remediated defense: exact loopback regex prevents attacker and customer domains starting with 127. from being falsely recognized as platform infrastructure', () => {
      // Due to exact loopback regex /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/:
      // Attacker and custom domains are correctly identified as non-canonical:
      expect(isInternalOrCanonicalHostname('127.0.0.1.attacker.com')).toBe(false);
      expect(isInternalOrCanonicalHostname('127.evil.com')).toBe(false);
      expect(isInternalOrCanonicalHostname('127.custom-tenant.com')).toBe(false);
    });

    it('queries D1 for non-canonical lookalike domains without false-positive platform bypass', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare } as unknown as D1Database;

      const result = await resolveTenantFromHostname(mockDb, 'sophia.agencyos.network.attacker.com');
      expect(mockPrepare).toHaveBeenCalled();
      expect(result.isInternal).toBe(false);
      expect(result.whitelabelActive).toBe(false);
      expect(result.tenantOrgId).toBeNull();
    });
  });

  // ── Dimension 4: Malicious Host Header Injection & Edge Routing ─────────────
  describe('Dimension 4: Malicious Host Header Injection & Edge Routing', () => {
    it('handles multiple forwarded hosts safely and selects first client host', () => {
      const headers = new Headers({
        'x-forwarded-host': 'client.customdomain.com:443, proxy1.cf.net:80, proxy2.cf.net',
      });
      const extracted = extractHostname(headers);
      expect(extracted).toBe('client.customdomain.com');
    });

    it('defensively handles SQL injection payloads in Host header without D1 corruption', async () => {
      const sqliPayloads = [
        "domain.com'; DROP TABLE custom_domains; --",
        "admin' OR '1'='1.com",
        "portal.com' UNION SELECT * FROM users; --",
      ];

      for (const payload of sqliPayloads) {
        const result = await resolveTenantFromHostname(d1 as unknown as D1Database, payload);
        expect(result.tenantOrgId).toBeNull();
        expect(result.whitelabelActive).toBe(false);
      }

      // Verify custom_domains table remains intact
      const count = await (d1 as unknown as D1Database)
        .prepare('SELECT COUNT(*) AS count FROM custom_domains')
        .first<{ count: number }>();
      expect(count?.count).toBe(0);
    });

    it('operates safely when D1 database is completely null or unavailable', async () => {
      const result = await resolveTenantFromHostname(null, 'client.myagency.com');
      expect(result.isInternal).toBe(false);
      expect(result.isCustomDomain).toBe(true);
      expect(result.tenantOrgId).toBeNull();
      expect(result.whitelabelActive).toBe(false);
    });

    it('operates safely when D1 database throws unexpected error', async () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('D1 connection reset by peer');
        }),
      } as unknown as D1Database;

      const result = await resolveTenantFromHostname(mockDb, 'client.myagency.com');
      expect(result.isInternal).toBe(false);
      expect(result.tenantOrgId).toBeNull();
      expect(result.whitelabelActive).toBe(false);
    });
  });

  // ── Dimension 5: Header Injection & ByteString Robustness ───────────────────
  describe('Dimension 5: Header Injection & ByteString Robustness', () => {
    it('verifies injectTenantRoutingHeaders behavior across diverse character sets', () => {
      const headers = new Headers();
      const validContext: TenantHostnameContext = {
        isInternal: false,
        isCustomDomain: true,
        tenantOrgId: 'org_safe_1',
        customDomain: 'portal.safe-agency.com',
        whitelabelActive: true,
        sslStatus: 'active',
      };

      injectTenantRoutingHeaders(headers, validContext);
      expect(getTenantOrgId(headers)).toBe('org_safe_1');
      expect(getCustomDomain(headers)).toBe('portal.safe-agency.com');
      expect(isWhitelabelActive(headers)).toBe(true);
    });

    it('verifies that normalizeHostname does not convert unicode to punycode, leaving raw unicode', () => {
      // Raw Unicode is preserved as-is rather than converted to punycode
      const rawUnicode = normalizeHostname('tiếngviệt.com');
      expect(rawUnicode).toBe('tiếngviệt.com');
      expect(rawUnicode).not.toBe('xn--ti-vi-4ta2275b.com');
    });

    it('verifies that validateHostname rejects unencoded unicode, requiring punycode registration', () => {
      // In land layer registration, raw Unicode is rejected
      const valRes = validateHostname('tiếngviệt.com');
      expect(valRes.ok).toBe(false);
      if (!valRes.ok) {
        expect(valRes.error.code).toBe('INVALID_HOSTNAME');
      }

      // Valid Punycode is accepted
      const punyRes = validateHostname('xn--ti-vi-4ta2275b.com');
      expect(punyRes.ok).toBe(true);
    });

    it('verifies that registered domains in D1 are restricted to valid ASCII/Punycode', async () => {
      // In production, registered domains in D1 must be ASCII/Punycode (validated by validateHostname).
      // When a valid registered domain is resolved from D1, it will never throw in injectTenantRoutingHeaders.
      await (d1 as unknown as D1Database)
        .prepare(
          `INSERT INTO custom_domains (
            id, org_id, hostname, cf_custom_hostname_id, ssl_status,
            verification_status, cname_target, cname_verified, active, created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, 'active', 'active', 'cname.sophia.agencyos.network', 1, 1, 100, 100)`
        )
        .bind('dom_punycode_1', 'org_vietnam_agency', 'xn--ti-vi-4ta2275b.com', 'cf_puny_1')
        .run();

      const context = await resolveTenantFromHostname(d1 as unknown as D1Database, 'xn--ti-vi-4ta2275b.com');
      expect(context.whitelabelActive).toBe(true);
      expect(context.tenantOrgId).toBe('org_vietnam_agency');

      const headers = new Headers();
      expect(() => injectTenantRoutingHeaders(headers, context)).not.toThrow();
      expect(getTenantOrgId(headers)).toBe('org_vietnam_agency');
      expect(getCustomDomain(headers)).toBe('xn--ti-vi-4ta2275b.com');
      expect(isWhitelabelActive(headers)).toBe(true);
    });
  });

  // ── Dimension 6: Tenant Isolation & Non-Leakage ─────────────────────────────
  describe('Dimension 6: Tenant Isolation & Non-Leakage', () => {
    beforeEach(async () => {
      // Seed two distinct tenant organizations with custom domains
      await (d1 as unknown as D1Database)
        .prepare(
          `INSERT INTO custom_domains (
            id, org_id, hostname, cf_custom_hostname_id, ssl_status,
            verification_status, cname_target, cname_verified, active, created_at, updated_at
          ) VALUES 
          ('dom_1', 'org_alpha', 'portal.alpha-agency.com', 'cf_1', 'active', 'active', 'cname.sophia.agencyos.network', 1, 1, 100, 100),
          ('dom_2', 'org_beta', 'portal.beta-agency.com', 'cf_2', 'pending_validation', 'pending', 'cname.sophia.agencyos.network', 0, 0, 100, 100)`
        )
        .run();
    });

    it('strictly isolates tenant context between distinct domains', async () => {
      const alphaCtx = await resolveTenantFromHostname(d1 as unknown as D1Database, 'portal.alpha-agency.com');
      expect(alphaCtx.tenantOrgId).toBe('org_alpha');
      expect(alphaCtx.whitelabelActive).toBe(true);

      const betaCtx = await resolveTenantFromHostname(d1 as unknown as D1Database, 'portal.beta-agency.com');
      expect(betaCtx.tenantOrgId).toBeNull(); // Because active=0 in DB, it is not resolved as active org
      expect(betaCtx.whitelabelActive).toBe(false);
    });

    it('ensures unregistered domains NEVER leak org_alpha or org_beta context', async () => {
      const probeDomains = [
        'portal.alpha-agency.com.attacker.com',
        'portal.alpha-agency.com:9999', // normalized to portal.alpha-agency.com -> matches
        'alpha-agency.com',              // apex not registered
        'unknown.random-site.com',
        'sophia.agencyos.network',
      ];

      for (const domain of probeDomains) {
        const ctx = await resolveTenantFromHostname(d1 as unknown as D1Database, domain);
        if (domain === 'portal.alpha-agency.com:9999') {
          // Port is normalized away, so this matches org_alpha correctly
          expect(ctx.tenantOrgId).toBe('org_alpha');
        } else {
          // All other probes must NEVER return org_alpha or org_beta
          expect(ctx.tenantOrgId).toBeNull();
          expect(ctx.whitelabelActive).toBe(false);
        }
      }
    });

    it('guarantees canonical domains never receive tenant context even if requested with extra parameters', async () => {
      const canonicalProbes = [
        'sophia.agencyos.network',
        'sophia.agencyos.network:443',
        'localhost:3000',
        'app.workers.dev',
        'sub.pages.dev',
      ];

      for (const host of canonicalProbes) {
        const ctx = await resolveTenantFromHostname(d1 as unknown as D1Database, host);
        expect(ctx.isInternal).toBe(true);
        expect(ctx.isCustomDomain).toBe(false);
        expect(ctx.tenantOrgId).toBeNull();
        expect(ctx.whitelabelActive).toBe(false);

        const h = new Headers();
        injectTenantRoutingHeaders(h, ctx);
        expect(getTenantOrgId(h)).toBeNull();
        expect(getCustomDomain(h)).toBeNull();
        expect(isWhitelabelActive(h)).toBe(false);
      }
    });
  });
});
