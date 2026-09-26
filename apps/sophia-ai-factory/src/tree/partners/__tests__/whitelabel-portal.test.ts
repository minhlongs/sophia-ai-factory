/**
 * Unit Test Suite: Advanced White-Label & Custom Domain Federation
 *
 * Layer: tree/partners/__tests__/whitelabel-portal.test.ts
 *
 * Verifies:
 * 1. CSS variable generation and strict injection sanitization
 * 2. Custom domain resolution to agency slug and tenant isolation
 * 3. Resend DKIM/SPF verification record generation and validation
 * 4. Complete elimination of vendor branding in metadata and portal views
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  resolveWhitelabelTheme,
  sanitizeBrandCss,
  sanitizeUrlForCss,
  validateHexColor,
  generateThemeCssBlock,
  resolveAgencyByDomain,
  resolveAgencyBySlug,
  renderUnbrandedPortalMetadata,
  type UnbrandedAgencyPortalConfig,
} from '../whitelabel-portal';
import {
  provisionResendDomain,
  verifyResendDomainStatus,
  getAgencyEmailSender,
  isValidDomainName,
  type ResendDnsRecord,
} from '../resend-domain-service';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

function createTestDb(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      partner_type TEXT NOT NULL DEFAULT 'agency',
      tier TEXT NOT NULL DEFAULT 'PLATINUM',
      commission_rate_pct REAL NOT NULL DEFAULT 35.0,
      referral_code TEXT NOT NULL UNIQUE,
      custom_domain TEXT UNIQUE,
      whitelabel_enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_organizations (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      organization_type TEXT NOT NULL DEFAULT 'master_agency',
      tier TEXT NOT NULL DEFAULT 'PLATINUM',
      cascade_override_pct REAL NOT NULL DEFAULT 5.0,
      billing_email TEXT NOT NULL,
      custom_domain TEXT UNIQUE,
      whitelabel_config_json TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS partner_whitelabel_configs (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL UNIQUE,
      brand_name TEXT NOT NULL,
      logo_url TEXT,
      favicon_url TEXT,
      primary_color TEXT DEFAULT '#06b6d4',
      accent_color TEXT DEFAULT '#3b82f6',
      custom_domain TEXT UNIQUE,
      custom_email_sender TEXT,
      support_url TEXT,
      footer_html TEXT,
      is_ssl_active INTEGER NOT NULL DEFAULT 0,
      dns_txt_verification_token TEXT,
      dns_verified_at INTEGER,
      agency_slug TEXT,
      portal_title TEXT,
      login_headline TEXT,
      login_subheading TEXT,
      custom_css TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id)
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0) } };
            },
            all: async <T>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0 } };
            },
          };
        },
        first: async <T>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0) } };
        },
        all: async <T>() => {
          return { results: stmt.all() as T[], meta: { changes: 0 } };
        },
      };
    },
  } as unknown as D1Database;
}

describe('Advanced White-Label & Custom Domain Federation Test Suite', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  // ============================================================================
  // 1. CSS Variable Generation & Injection Sanitization
  // ============================================================================
  describe('1. CSS Variable Generation & Injection Sanitization', () => {
    it('generates standard CSS variables for full agency white-label branding', () => {
      const config: Partial<UnbrandedAgencyPortalConfig> = {
        brandName: 'Apex Media Studio',
        primaryColor: '#6366f1',
        secondaryColor: '#ec4899',
        logoUrl: 'https://cdn.apexmedia.com/logo.svg',
        faviconUrl: 'https://cdn.apexmedia.com/favicon.ico',
        supportUrl: 'https://apexmedia.com/help',
        portalTitle: 'Apex Creative Cloud',
      };

      const theme = resolveWhitelabelTheme(config);
      expect(theme['--brand-primary']).toBe('#6366f1');
      expect(theme['--brand-secondary']).toBe('#ec4899');
      expect(theme['--brand-accent']).toBe('#ec4899');
      expect(theme['--brand-logo-url']).toBe('url("https://cdn.apexmedia.com/logo.svg")');
      expect(theme['--brand-favicon']).toBe('url("https://cdn.apexmedia.com/favicon.ico")');
      expect(theme['--brand-favicon-url']).toBe('https://cdn.apexmedia.com/favicon.ico');
      expect(theme['--brand-agency-name']).toBe('"Apex Media Studio"');
      expect(theme['--brand-support-url']).toBe('https://apexmedia.com/help');
      expect(theme['--brand-portal-title']).toBe('"Apex Creative Cloud"');
      expect(theme['--primary']).toBe('#6366f1');
    });

    it('falls back to safe defaults when branding fields are omitted or null', () => {
      const theme = resolveWhitelabelTheme(null);
      expect(theme['--brand-primary']).toBe('#06b6d4');
      expect(theme['--brand-secondary']).toBe('#3b82f6');
      expect(theme['--brand-logo-url']).toBe('none');
      expect(theme['--brand-favicon']).toBe('none');
      expect(theme['--brand-favicon-url']).toBe('');
      expect(theme['--brand-agency-name']).toBe('"Agency Client Portal"');
    });

    it('validates hex colors and rejects CSS breakout values', () => {
      expect(validateHexColor('#10b981', '#06b6d4')).toBe('#10b981');
      expect(validateHexColor('#ABCDEF', '#06b6d4')).toBe('#ABCDEF');
      // Rejects invalid strings
      expect(validateHexColor('red', '#06b6d4')).toBe('#06b6d4');
      expect(validateHexColor('#12345', '#06b6d4')).toBe('#06b6d4');
      expect(validateHexColor('#1234567', '#06b6d4')).toBe('#06b6d4');
      expect(validateHexColor('#000; display: none;', '#06b6d4')).toBe('#06b6d4');
      expect(validateHexColor('#fff} body { opacity: 0; }', '#06b6d4')).toBe('#06b6d4');
      expect(validateHexColor(null, '#06b6d4')).toBe('#06b6d4');
    });

    it('sanitizes URLs for safe CSS embedding against XSS and breakout attacks', () => {
      expect(sanitizeUrlForCss('https://cdn.agency.com/logo.png')).toBe('https://cdn.agency.com/logo.png');
      expect(sanitizeUrlForCss('/assets/logo.svg')).toBe('/assets/logo.svg');

      // Rejects protocol injections
      expect(sanitizeUrlForCss('javascript:alert(1)')).toBe('');
      expect(sanitizeUrlForCss('vbscript:msgbox(1)')).toBe('');
      expect(sanitizeUrlForCss('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe('');

      // Rejects quote breakouts and brackets
      expect(sanitizeUrlForCss('https://cdn.agency.com/logo"test.png')).toBe('');
      expect(sanitizeUrlForCss("https://cdn.agency.com/logo'test.png")).toBe('');
      expect(sanitizeUrlForCss('https://cdn.agency.com/logo)test.png')).toBe('');
      expect(sanitizeUrlForCss('https://cdn.agency.com/logo<script>.png')).toBe('');
      expect(sanitizeUrlForCss('https://cdn.agency.com/logo;test.png')).toBe('');
    });

    it('rigorously strips <script> tags from custom CSS', () => {
      const maliciousCss = `
        .header { background: #1e293b; }
        <script>alert("xss")</script>
        .footer { color: #64748b; }
      `;
      const cleaned = sanitizeBrandCss(maliciousCss);
      expect(cleaned).not.toContain('<script>');
      expect(cleaned).not.toContain('alert("xss")');
      expect(cleaned).toContain('.header { background: #1e293b; }');
      expect(cleaned).toContain('.footer { color: #64748b; }');
    });

    it('strips </style> and <style> tags to prevent style element breakout', () => {
      const breakoutCss = `
        body { font-family: sans-serif; }
        </style><script src="https://evil.com/xss.js"></script><style>
        .nav { display: flex; }
      `;
      const cleaned = sanitizeBrandCss(breakoutCss);
      expect(cleaned).not.toContain('</style>');
      expect(cleaned).not.toContain('<style>');
      expect(cleaned).not.toContain('<script');
      expect(cleaned).not.toContain('evil.com');
      expect(cleaned).toContain('body { font-family: sans-serif; }');
      expect(cleaned).toContain('.nav { display: flex; }');
    });

    it('strips @import directives completely to prevent external CSS loading', () => {
      const importCss = `
        @import url("https://malicious.com/stealer.css");
        @import 'https://evil.com/font.css';
        @import "http://tracker.com/pixel.css";
        .btn { padding: 8px 16px; }
      `;
      const cleaned = sanitizeBrandCss(importCss);
      expect(cleaned).not.toContain('@import');
      expect(cleaned).not.toContain('malicious.com');
      expect(cleaned).not.toContain('evil.com');
      expect(cleaned).not.toContain('tracker.com');
      expect(cleaned).toContain('.btn { padding: 8px 16px; }');
    });

    it('strips url(javascript:...) and expression() execution vectors', () => {
      const exploitCss = `
        .card { background-image: url(javascript:alert("XSS")); }
        .sidebar { width: expression(alert(1)); }
        .banner { behavior: url(script.htc); }
      `;
      const cleaned = sanitizeBrandCss(exploitCss);
      expect(cleaned).not.toContain('javascript:alert');
      expect(cleaned).not.toContain('expression(alert');
      expect(cleaned).not.toContain('behavior:');
    });

    it('generates a clean, scoped :root theme block with custom styles', () => {
      const vars = {
        '--brand-primary': '#4f46e5',
        '--brand-secondary': '#06b6d4',
      };
      const custom = '.portal-badge { border-radius: 9999px; }';
      const cssBlock = generateThemeCssBlock(vars, custom);

      expect(cssBlock).toContain(':root {');
      expect(cssBlock).toContain('--brand-primary: #4f46e5;');
      expect(cssBlock).toContain('--brand-secondary: #06b6d4;');
      expect(cssBlock).toContain('.portal-badge { border-radius: 9999px; }');
    });
  });

  // ============================================================================
  // 2. Custom Domain Resolution to Agency Configuration
  // ============================================================================
  describe('2. Custom Domain Resolution to Agency Configuration', () => {
    const partnerId = 'ptn_apex_001';

    beforeEach(async () => {
      // Seed partner profile
      await db
        .prepare(
          `INSERT INTO partner_profiles
           (id, user_id, tenant_id, partner_name, referral_code, custom_domain, whitelabel_enabled, status, created_at, updated_at)
           VALUES (?1, 'usr_apex_01', 'ten_apex', 'Apex Agency', 'APEX-REF', 'portal.apexagency.com', 1, 'active', ?2, ?2)`
        )
        .bind(partnerId, Date.now())
        .run();

      // Seed partner organization
      await db
        .prepare(
          `INSERT INTO partner_organizations
           (id, partner_id, tenant_id, name, slug, billing_email, custom_domain, status, created_at, updated_at)
           VALUES ('org_apex', ?1, 'ten_apex', 'Apex Agency', 'apex-agency', 'admin@apexagency.com', 'portal.apexagency.com', 'active', ?2, ?2)`
        )
        .bind(partnerId, Date.now())
        .run();

      // Seed whitelabel config
      await db
        .prepare(
          `INSERT INTO partner_whitelabel_configs
           (id, partner_id, brand_name, logo_url, favicon_url, primary_color, accent_color,
            custom_domain, custom_email_sender, support_url, footer_html, is_ssl_active,
            agency_slug, portal_title, login_headline, login_subheading, custom_css, created_at, updated_at)
           VALUES ('wlc_apex', ?1, 'Apex Brand Studio', 'https://cdn.apex.com/logo.png', 'https://cdn.apex.com/favicon.ico',
                   '#06b6d4', '#3b82f6', 'portal.apexagency.com', 'marketing@apexagency.com',
                   'https://apexagency.com/support', '<p>Apex Copyright</p>', 1,
                   'apex-agency', 'Apex Client Portal', 'Welcome to Apex Studio', 'Your automated AI video factory',
                   '.brand-header { font-weight: bold; }', ?2, ?2)`
        )
        .bind(partnerId, Date.now())
        .run();
    });

    it('resolves active custom domain to complete unbranded configuration', async () => {
      const config = await resolveAgencyByDomain(db, 'portal.apexagency.com');
      expect(config).not.toBeNull();
      expect(config?.partnerId).toBe(partnerId);
      expect(config?.agencySlug).toBe('apex-agency');
      expect(config?.brandName).toBe('Apex Brand Studio');
      expect(config?.primaryColor).toBe('#06b6d4');
      expect(config?.secondaryColor).toBe('#3b82f6');
      expect(config?.logoUrl).toBe('https://cdn.apex.com/logo.png');
      expect(config?.faviconUrl).toBe('https://cdn.apex.com/favicon.ico');
      expect(config?.customEmailSender).toBe('marketing@apexagency.com');
      expect(config?.portalTitle).toBe('Apex Client Portal');
      expect(config?.isSslActive).toBe(true);
    });

    it('handles case-insensitive hostname resolution and trims whitespace', async () => {
      const configUpper = await resolveAgencyByDomain(db, 'PORTAL.APEXAGENCY.COM');
      expect(configUpper).not.toBeNull();
      expect(configUpper?.agencySlug).toBe('apex-agency');

      const configSpaces = await resolveAgencyByDomain(db, '   portal.apexagency.com   ');
      expect(configSpaces).not.toBeNull();
      expect(configSpaces?.agencySlug).toBe('apex-agency');
    });

    it('returns null for unverified or pending SSL domain', async () => {
      // Set SSL inactive
      await db
        .prepare('UPDATE partner_whitelabel_configs SET is_ssl_active = 0 WHERE partner_id = ?1')
        .bind(partnerId)
        .run();
      await db
        .prepare("UPDATE partner_organizations SET status = 'pending' WHERE partner_id = ?1")
        .bind(partnerId)
        .run();

      const config = await resolveAgencyByDomain(db, 'portal.apexagency.com');
      expect(config).toBeNull();
    });

    it('returns null for unknown domain or localhost', async () => {
      const unknown = await resolveAgencyByDomain(db, 'unknown.otherdomain.com');
      expect(unknown).toBeNull();

      const local = await resolveAgencyByDomain(db, 'localhost');
      expect(local).toBeNull();

      const ip = await resolveAgencyByDomain(db, '127.0.0.1');
      expect(ip).toBeNull();
    });

    it('resolves agency configuration by agency slug (/portal/[agencySlug])', async () => {
      const config = await resolveAgencyBySlug(db, 'apex-agency');
      expect(config).not.toBeNull();
      expect(config?.partnerId).toBe(partnerId);
      expect(config?.brandName).toBe('Apex Brand Studio');
      expect(config?.loginHeadline).toBe('Welcome to Apex Studio');

      // Returns null for non-existent slug
      const missing = await resolveAgencyBySlug(db, 'nonexistent-agency');
      expect(missing).toBeNull();
    });

    it('resolves agency from partner_organizations when whitelabel_config row is minimal', async () => {
      const secondPartnerId = 'ptn_beta_002';

      await db
        .prepare(
          `INSERT INTO partner_profiles
           (id, user_id, tenant_id, partner_name, referral_code, custom_domain, whitelabel_enabled, status, created_at, updated_at)
           VALUES (?1, 'usr_beta_02', 'ten_beta', 'Beta Growth Agency', 'BETA-REF', 'portal.betagrowth.io', 1, 'active', ?2, ?2)`
        )
        .bind(secondPartnerId, Date.now())
        .run();

      await db
        .prepare(
          `INSERT INTO partner_organizations
           (id, partner_id, tenant_id, name, slug, billing_email, custom_domain, whitelabel_config_json, status, created_at, updated_at)
           VALUES ('org_beta', ?1, 'ten_beta', 'Beta Growth Agency', 'beta-growth', 'ceo@betagrowth.io', 'portal.betagrowth.io',
                   '{"brandName":"Beta Creative Hub","primaryColor":"#10b981","secondaryColor":"#059669"}', 'active', ?2, ?2)`
        )
        .bind(secondPartnerId, Date.now())
        .run();

      const config = await resolveAgencyByDomain(db, 'portal.betagrowth.io');
      expect(config).not.toBeNull();
      expect(config?.brandName).toBe('Beta Creative Hub');
      expect(config?.primaryColor).toBe('#10b981');
      expect(config?.secondaryColor).toBe('#059669');
      expect(config?.agencySlug).toBe('beta-growth');
    });
  });

  // ============================================================================
  // 3. Resend Custom Email Domain Management
  // ============================================================================
  describe('3. Resend Custom Email Domain Management', () => {
    it('validates domain names for email provisioning', () => {
      expect(isValidDomainName('agencybrand.com')).toBe(true);
      expect(isValidDomainName('mail.creativeagency.vn')).toBe(true);
      expect(isValidDomainName('sub.domain.co.uk')).toBe(true);

      // Rejects invalid domains
      expect(isValidDomainName('')).toBe(false);
      expect(isValidDomainName('localhost')).toBe(false);
      expect(isValidDomainName('192.168.1.1')).toBe(false);
      expect(isValidDomainName('not_a_valid_domain')).toBe(false);
      expect(isValidDomainName('domainwithouttld')).toBe(false);
    });

    it('provisions Resend email domain and generates valid DKIM & SPF records', async () => {
      const result = await provisionResendDomain('agencybrand.com');
      expect(result.success).toBe(true);
      expect(result.domainName).toBe('agencybrand.com');
      expect(result.status).toBe('pending');
      expect(result.records.length).toBeGreaterThanOrEqual(3);

      // Verify DKIM record
      expect(result.dkimRecord).toBeDefined();
      expect(result.dkimRecord?.record).toBe('DKIM');
      expect(result.dkimRecord?.type).toBe('TXT');
      expect(result.dkimRecord?.name).toContain('resend._domainkey');
      expect(result.dkimRecord?.value).toMatch(/^p=MIGfMA0/);
      expect(result.dkimRecord?.status).toBe('pending');

      // Verify SPF MX record
      expect(result.spfMxRecord).toBeDefined();
      expect(result.spfMxRecord?.record).toBe('SPF');
      expect(result.spfMxRecord?.type).toBe('MX');
      expect(result.spfMxRecord?.value).toContain('amazonses.com');
      expect(result.spfMxRecord?.priority).toBe(10);

      // Verify SPF TXT record
      expect(result.spfTxtRecord).toBeDefined();
      expect(result.spfTxtRecord?.record).toBe('SPF');
      expect(result.spfTxtRecord?.type).toBe('TXT');
      expect(result.spfTxtRecord?.value).toContain('v=spf1 include:amazonses.com');
    });

    it('rejects provisioning invalid domain names', async () => {
      const result = await provisionResendDomain('invalid_domain_name');
      expect(result.success).toBe(false);
      expect(result.error).toContain('INVALID_DOMAIN_NAME');
      expect(result.records).toHaveLength(0);
    });

    it('verifies Resend domain status with mock DNS propagation', async () => {
      const domainId = 'resend_dom_agencybrand_com';

      // 1. Pending state
      const pendingCheck = await verifyResendDomainStatus(domainId);
      expect(pendingCheck.success).toBe(true);
      expect(pendingCheck.isVerified).toBe(false);
      expect(pendingCheck.status).toBe('pending');

      // 2. Verified state
      const verifiedCheck = await verifyResendDomainStatus(domainId, { forceSuccess: true });
      expect(verifiedCheck.success).toBe(true);
      expect(verifiedCheck.isVerified).toBe(true);
      expect(verifiedCheck.status).toBe('verified');
      expect(verifiedCheck.dkimStatus).toBe('verified');
      expect(verifiedCheck.spfStatus).toBe('verified');
    });

    it('evaluates status from specific DNS record states', async () => {
      const mockRecords: ResendDnsRecord[] = [
        {
          record: 'DKIM',
          name: 'resend._domainkey.agency.com',
          type: 'TXT',
          value: 'p=key',
          status: 'verified',
        },
        {
          record: 'SPF',
          name: 'bounces.agency.com',
          type: 'MX',
          value: 'amazonses.com',
          status: 'pending',
        },
      ];

      const check = await verifyResendDomainStatus('dom_test', { mockRecords });
      expect(check.dkimStatus).toBe('verified');
      expect(check.spfStatus).toBe('pending');
      expect(check.isVerified).toBe(false);
    });

    it('formats agency outbound email sender without vendor strings', () => {
      // 1. Full brand name + custom domain
      const sender1 = getAgencyEmailSender({
        brandName: 'Apex Media Studio',
        customDomain: 'apexmedia.com',
      });
      expect(sender1).toBe('Apex Media Studio <marketing@apexmedia.com>');

      // 2. Specific custom email sender with name
      const sender2 = getAgencyEmailSender({
        brandName: 'Apex',
        customEmailSender: 'notifications@agencymail.com',
      });
      expect(sender2).toBe('Apex <notifications@agencymail.com>');

      // 3. Sender with full pre-formatted angle bracket
      const sender3 = getAgencyEmailSender({
        customEmailSender: 'Creative Team <hello@creatives.vn>',
      });
      expect(sender3).toBe('Creative Team <hello@creatives.vn>');

      // 4. Sanitizes email header injection attempts
      const senderInjected = getAgencyEmailSender({
        brandName: 'Hacker\r\nBcc: evil@attacker.com',
        customEmailSender: 'admin@agency.com\nSubject: Injected',
      });
      expect(senderInjected).not.toContain('\r');
      expect(senderInjected).not.toContain('\n');
      expect(senderInjected).not.toContain('Bcc:');
      expect(senderInjected).not.toContain('Subject:');
      expect(senderInjected).not.toContain('evil@attacker.com');
      expect(senderInjected).toBe('Hacker <admin@agency.com>');
    });
  });

  // ============================================================================
  // 4. Complete Elimination of Vendor Branding
  // ============================================================================
  describe('4. Complete Elimination of Vendor Branding', () => {
    it('renders unbranded portal metadata in English with zero vendor strings', () => {
      const config: Partial<UnbrandedAgencyPortalConfig> = {
        agencySlug: 'growth-apex',
        agencyName: 'Growth Apex Co.',
        brandName: 'Apex Creative Studio',
        portalTitle: 'Apex Client Hub',
        logoUrl: 'https://cdn.apex.com/logo.png',
        faviconUrl: 'https://cdn.apex.com/favicon.ico',
      };

      const meta = renderUnbrandedPortalMetadata(config, 'en');

      expect(meta.title).toBe('Apex Client Hub');
      expect(meta.description).toContain('Apex Creative Studio');
      expect(meta.openGraph.siteName).toBe('Apex Creative Studio');
      expect(meta.icons.icon).toBe('https://cdn.apex.com/favicon.ico');
      expect(meta.alternates?.canonical).toBe('/en/portal/growth-apex');

      // Test fallback when portalTitle is omitted
      const fallbackMeta = renderUnbrandedPortalMetadata(
        { agencySlug: 'alpha', brandName: 'Alpha Agency' },
        'en',
      );
      expect(fallbackMeta.title).toBe('Alpha Agency — Client Portal');

      // Strict Zero-Vendor Leakage Verification
      const serialized = JSON.stringify(meta);
      expect(serialized).not.toContain('Sophia');
      expect(serialized).not.toContain('sophia');
      expect(serialized).not.toContain('Sophia AI Factory');
      expect(serialized).not.toContain('AgencyOS');
    });

    it('renders unbranded portal metadata in Vietnamese with zero vendor strings', () => {
      const config: Partial<UnbrandedAgencyPortalConfig> = {
        agencySlug: 'viet-media',
        agencyName: 'Công ty Cổ phần Việt Media',
        brandName: 'Việt Media Cloud',
        portalTitle: 'Cổng Khách Hàng Doanh Nghiệp',
        logoUrl: 'https://vietmedia.vn/logo.png',
        faviconUrl: 'https://vietmedia.vn/favicon.ico',
      };

      const meta = renderUnbrandedPortalMetadata(config, 'vi');

      expect(meta.title).toBe('Cổng Khách Hàng Doanh Nghiệp');
      expect(meta.description).toContain('Việt Media Cloud');
      expect(meta.description).toContain('quản lý sản xuất video AI');
      expect(meta.alternates?.canonical).toBe('/vi/portal/viet-media');

      // Test Vietnamese fallback when portalTitle is omitted
      const fallbackMetaVi = renderUnbrandedPortalMetadata(
        { agencySlug: 'viet-media', brandName: 'Việt Media' },
        'vi',
      );
      expect(fallbackMetaVi.title).toBe('Việt Media — Cổng Khách Hàng');

      // Strict Zero-Vendor Leakage Verification
      const serialized = JSON.stringify(meta);
      expect(serialized).not.toContain('Sophia');
      expect(serialized).not.toContain('sophia');
      expect(serialized).not.toContain('Sophia AI Factory');
    });

    it('renders unbranded metadata safely when config is null', () => {
      const meta = renderUnbrandedPortalMetadata(null, 'en');
      expect(meta.title).toBe('Client Portal — Client Portal');
      expect(meta.description).toContain('Dedicated client portal');

      const serialized = JSON.stringify(meta);
      expect(serialized).not.toContain('Sophia');
      expect(serialized).not.toContain('sophia');
    });
  });

  // ============================================================================
  // 5. Multi-Tenant Isolation & Cross-Agency Scenarios
  // ============================================================================
  describe('5. Multi-Tenant Isolation & Cross-Agency Scenarios', () => {
    it('isolates configurations between two distinct enterprise white-label agencies', async () => {
      // Seed partner profiles for ptn_1 and ptn_2
      await db
        .prepare(
          `INSERT INTO partner_profiles
           (id, user_id, tenant_id, partner_name, referral_code, custom_domain, whitelabel_enabled, status, created_at, updated_at)
           VALUES ('ptn_1', 'usr_1', 'ten_1', 'Alpha Marketing', 'ALPHA-REF', 'portal.alpha.com', 1, 'active', ?1, ?1)`
        )
        .bind(Date.now())
        .run();

      await db
        .prepare(
          `INSERT INTO partner_profiles
           (id, user_id, tenant_id, partner_name, referral_code, custom_domain, whitelabel_enabled, status, created_at, updated_at)
           VALUES ('ptn_2', 'usr_2', 'ten_2', 'Beta Digital', 'BETA-REF-2', 'portal.betadigital.io', 1, 'active', ?1, ?1)`
        )
        .bind(Date.now())
        .run();

      // Agency 1
      await db
        .prepare(
          `INSERT INTO partner_whitelabel_configs
           (id, partner_id, brand_name, primary_color, accent_color, custom_domain,
            is_ssl_active, agency_slug, portal_title, created_at, updated_at)
           VALUES ('wlc_1', 'ptn_1', 'Alpha Marketing', '#111111', '#222222', 'portal.alpha.com',
                   1, 'alpha-agency', 'Alpha Studio', ?1, ?1)`
        )
        .bind(Date.now())
        .run();

      // Agency 2
      await db
        .prepare(
          `INSERT INTO partner_whitelabel_configs
           (id, partner_id, brand_name, primary_color, accent_color, custom_domain,
            is_ssl_active, agency_slug, portal_title, created_at, updated_at)
           VALUES ('wlc_2', 'ptn_2', 'Beta Digital', '#ff0055', '#aa0033', 'portal.betadigital.io',
                   1, 'beta-agency', 'Beta Creative', ?1, ?1)`
        )
        .bind(Date.now())
        .run();

      const agency1 = await resolveAgencyByDomain(db, 'portal.alpha.com');
      const agency2 = await resolveAgencyByDomain(db, 'portal.betadigital.io');

      expect(agency1?.brandName).toBe('Alpha Marketing');
      expect(agency1?.primaryColor).toBe('#111111');
      expect(agency1?.agencySlug).toBe('alpha-agency');

      expect(agency2?.brandName).toBe('Beta Digital');
      expect(agency2?.primaryColor).toBe('#ff0055');
      expect(agency2?.agencySlug).toBe('beta-agency');

      // Cross-check: theme CSS variables must differ
      const theme1 = resolveWhitelabelTheme(agency1);
      const theme2 = resolveWhitelabelTheme(agency2);

      expect(theme1['--brand-primary']).toBe('#111111');
      expect(theme2['--brand-primary']).toBe('#ff0055');
      expect(theme1['--brand-portal-title']).toBe('"Alpha Studio"');
      expect(theme2['--brand-portal-title']).toBe('"Beta Creative"');
    });
  });
});
