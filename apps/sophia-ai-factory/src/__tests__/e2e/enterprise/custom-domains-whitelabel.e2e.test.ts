/**
 * Enterprise Custom Domains & White-Label Portal — Comprehensive 4-Tier E2E Test Suite
 *
 * Covers:
 * - Feature 1: Custom domain registration & Cloudflare for SaaS CNAME assignment
 * - Feature 2: Verification lifecycle (pending_validation -> active | error)
 * - Feature 3: Hostname routing & tenant branding resolution
 * - Feature 4: Dynamic white-label theme CSS variable injection
 * - Feature 5: Branded transactional email templating
 *
 * Implements 4-Tier Test Architecture:
 * - Tier 1: Feature Coverage (>=5 tests per feature area)
 * - Tier 2: Boundary & Corner Cases (>=5 tests per feature area)
 * - Tier 3: Cross-Feature Combinations
 * - Tier 4: Real-World Scenarios
 *
 * @module __tests__/e2e/enterprise/custom-domains-whitelabel.e2e.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEnterpriseD1,
  registerCustomDomain,
  verifyCustomDomainStatus,
  resolveTenantFromHostname,
  resolveThemeCssVariables,
  wrapWithAgencyBranding,
  isValidHostname,
  type MockD1Database,
  type BrandingSettings,
} from './enterprise-test-harness';

describe('Enterprise Custom Domains & White-Label E2E Test Suite', () => {
  let db: MockD1Database;
  const testOrgId = 'org_agency_alpha';
  const secondOrgId = 'org_agency_beta';

  beforeEach(async () => {
    db = createEnterpriseD1();

    // Seed test organizations
    await db
      .prepare(
        `INSERT INTO organizations (id, name, slug, tier, max_seats, status, created_at, updated_at)
         VALUES (?1, 'Agency Alpha', 'agency-alpha', 'master', 999, 'active', ?2, ?2)`
      )
      .bind(testOrgId, Date.now())
      .run();

    await db
      .prepare(
        `INSERT INTO organizations (id, name, slug, tier, max_seats, status, created_at, updated_at)
         VALUES (?1, 'Agency Beta', 'agency-beta', 'master', 999, 'active', ?2, ?2)`
      )
      .bind(secondOrgId, Date.now())
      .run();
  });

  // ============================================================================
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature area)
  // ============================================================================
  describe('Tier 1: Feature Coverage', () => {
    describe('F1: Custom Domain Registration & CNAME Assignment', () => {
      it('F1-1: registers a valid custom subdomain with initial pending_validation status', async () => {
        const domain = await registerCustomDomain(db, testOrgId, 'videos.agencyalpha.com');
        expect(domain.id).toMatch(/^dom_/);
        expect(domain.org_id).toBe(testOrgId);
        expect(domain.hostname).toBe('videos.agencyalpha.com');
        expect(domain.status).toBe('pending_validation');
        expect(domain.ssl_status).toBe('pending');
        expect(domain.cname_target).toBe('cname.sophia.agencyos.network');
        expect(domain.verification_token).toMatch(/^cf-custom-domain-/);
      });

      it('F1-2: normalizes uppercase hostnames to lowercase', async () => {
        const domain = await registerCustomDomain(db, testOrgId, 'STUDIO.AGENCYALPHA.COM');
        expect(domain.hostname).toBe('studio.agencyalpha.com');
      });

      it('F1-3: trims whitespace from custom hostname', async () => {
        const domain = await registerCustomDomain(db, testOrgId, '  portal.agencyalpha.com  ');
        expect(domain.hostname).toBe('portal.agencyalpha.com');
      });

      it('F1-4: persists domain record into custom_domains table', async () => {
        const domain = await registerCustomDomain(db, testOrgId, 'app.agencyalpha.com');
        const record = await db
          .prepare('SELECT * FROM custom_domains WHERE id = ?1')
          .bind(domain.id)
          .first<{ hostname: string; org_id: string }>();

        expect(record).toBeDefined();
        expect(record?.hostname).toBe('app.agencyalpha.com');
        expect(record?.org_id).toBe(testOrgId);
      });

      it('F1-5: allows multiple distinct hostnames for the same organization', async () => {
        const d1 = await registerCustomDomain(db, testOrgId, 'media.agencyalpha.com');
        const d2 = await registerCustomDomain(db, testOrgId, 'creatives.agencyalpha.com');
        expect(d1.id).not.toBe(d2.id);
        expect(d1.hostname).toBe('media.agencyalpha.com');
        expect(d2.hostname).toBe('creatives.agencyalpha.com');
      });
    });

    describe('F2: Verification Lifecycle (Pending -> Active | Error)', () => {
      it('F2-1: transitions to active status when CNAME and SSL are valid', async () => {
        const domain = await registerCustomDomain(db, testOrgId, 'verify.agencyalpha.com');
        const result = await verifyCustomDomainStatus(db, domain.id, {
          cnameValid: true,
          sslActive: true,
        });

        expect(result.status).toBe('active');
        expect(result.sslStatus).toBe('active');
        expect(result.isVerified).toBe(true);
        expect(result.errorMessage).toBeUndefined();
      });

      it('F2-2: remains in pending_validation if CNAME is not yet propagated', async () => {
        const domain = await registerCustomDomain(db, testOrgId, 'pending.agencyalpha.com');
        const result = await verifyCustomDomainStatus(db, domain.id, {
          cnameValid: false,
          sslActive: false,
        });

        expect(result.status).toBe('pending_validation');
        expect(result.sslStatus).toBe('pending');
        expect(result.isVerified).toBe(false);
      });

      it('F2-3: transitions to error status when Cloudflare returns validation failure', async () => {
        const domain = await registerCustomDomain(db, testOrgId, 'broken.agencyalpha.com');
        const result = await verifyCustomDomainStatus(db, domain.id, {
          cnameValid: false,
          sslActive: false,
          errorMessage: 'CAA record forbids Cloudflare SSL issuance',
        });

        expect(result.status).toBe('error');
        expect(result.sslStatus).toBe('error');
        expect(result.isVerified).toBe(false);
        expect(result.errorMessage).toBe('CAA record forbids Cloudflare SSL issuance');
      });

      it('F2-4: allows recovering from error state to active upon successful re-check', async () => {
        const domain = await registerCustomDomain(db, testOrgId, 'recover.agencyalpha.com');
        await verifyCustomDomainStatus(db, domain.id, {
          cnameValid: false,
          sslActive: false,
          errorMessage: 'DNS resolution failure',
        });

        const recheck = await verifyCustomDomainStatus(db, domain.id, {
          cnameValid: true,
          sslActive: true,
        });

        expect(recheck.status).toBe('active');
        expect(recheck.isVerified).toBe(true);
        expect(recheck.errorMessage).toBeUndefined();
      });

      it('F2-5: throws descriptive error when verifying non-existent domain ID', async () => {
        await expect(verifyCustomDomainStatus(db, 'dom_nonexistent')).rejects.toThrow(
          /DOMAIN_NOT_FOUND/
        );
      });
    });

    describe('F3: Hostname Routing & Tenant Branding Resolution', () => {
      it('F3-1: resolves tenant context and branding for verified active domain', async () => {
        const domain = await registerCustomDomain(db, testOrgId, 'portal.agencyalpha.com');
        await verifyCustomDomainStatus(db, domain.id, { cnameValid: true, sslActive: true });

        await db
          .prepare(
            `INSERT INTO org_branding (org_id, agency_name, logo_url, primary_color, created_at, updated_at)
             VALUES (?1, 'Alpha Media Agency', 'https://assets.alpha.com/logo.png', '#1e293b', ?2, ?2)`
          )
          .bind(testOrgId, Date.now())
          .run();

        const context = await resolveTenantFromHostname(db, 'portal.agencyalpha.com');
        expect(context).not.toBeNull();
        expect(context?.orgId).toBe(testOrgId);
        expect(context?.branding.agencyName).toBe('Alpha Media Agency');
        expect(context?.branding.logoUrl).toBe('https://assets.alpha.com/logo.png');
        expect(context?.branding.primaryColor).toBe('#1e293b');
      });

      it('F3-2: returns null for unverified pending_validation hostname', async () => {
        await registerCustomDomain(db, testOrgId, 'unverified.agencyalpha.com');
        const context = await resolveTenantFromHostname(db, 'unverified.agencyalpha.com');
        expect(context).toBeNull();
      });

      it('F3-3: returns null for unknown unmapped hostname', async () => {
        const context = await resolveTenantFromHostname(db, 'unknown.externaldomain.com');
        expect(context).toBeNull();
      });

      it('F3-4: returns default branding fallback when org_branding row is empty', async () => {
        const domain = await registerCustomDomain(db, testOrgId, 'default.agencyalpha.com');
        await verifyCustomDomainStatus(db, domain.id, { cnameValid: true, sslActive: true });

        const context = await resolveTenantFromHostname(db, 'default.agencyalpha.com');
        expect(context).not.toBeNull();
        expect(context?.branding.primaryColor).toBe('#0f172a');
        expect(context?.branding.secondaryColor).toBe('#3b82f6');
      });

      it('F3-5: handles case-insensitive incoming HTTP host header during resolution', async () => {
        const domain = await registerCustomDomain(db, testOrgId, 'mixedcase.agencyalpha.com');
        await verifyCustomDomainStatus(db, domain.id, { cnameValid: true, sslActive: true });

        const context = await resolveTenantFromHostname(db, 'MixedCase.AgencyAlpha.Com');
        expect(context).not.toBeNull();
        expect(context?.orgId).toBe(testOrgId);
      });
    });

    describe('F4: Dynamic White-Label Theme CSS Variable Injection', () => {
      it('F4-1: generates standard CSS variables for full agency branding', () => {
        const branding: BrandingSettings = {
          agencyName: 'Agency Alpha',
          portalTitle: 'Alpha Creative Studio',
          primaryColor: '#6366f1',
          secondaryColor: '#ec4899',
          logoUrl: 'https://cdn.agency.com/logo.svg',
        };

        const vars = resolveThemeCssVariables(branding);
        expect(vars['--theme-primary']).toBe('#6366f1');
        expect(vars['--theme-secondary']).toBe('#ec4899');
        expect(vars['--theme-logo']).toBe('url("https://cdn.agency.com/logo.svg")');
        expect(vars['--theme-portal-title']).toBe('"Alpha Creative Studio"');
      });

      it('F4-2: falls back to system defaults when branding fields are absent', () => {
        const vars = resolveThemeCssVariables({});
        expect(vars['--theme-primary']).toBe('#0f172a');
        expect(vars['--theme-secondary']).toBe('#3b82f6');
        expect(vars['--theme-logo']).toBe('none');
        expect(vars['--theme-portal-title']).toBe('"Sophia AI Factory"');
      });

      it('F4-3: includes custom CSS string unmodified when provided', () => {
        const branding: BrandingSettings = {
          customCss: '.sidebar { background: #111; }',
        };
        const vars = resolveThemeCssVariables(branding);
        expect(vars['--theme-custom-css']).toBe('.sidebar { background: #111; }');
      });

      it('F4-4: strips quotation marks from logoUrl in CSS url expression to avoid CSS breakout', () => {
        const branding: BrandingSettings = {
          logoUrl: 'https://cdn.agency.com/logo"test.svg',
        };
        const vars = resolveThemeCssVariables(branding);
        expect(vars['--theme-logo']).toBe('url("https://cdn.agency.com/logotest.svg")');
      });

      it('F4-5: sanitizes color values against CSS injection payloads', () => {
        const branding: BrandingSettings = {
          primaryColor: '#000; display: none;',
          secondaryColor: 'blue; } body { opacity: 0; }',
        };
        const vars = resolveThemeCssVariables(branding);
        expect(vars['--theme-primary']).toBe('#0f172a'); // Reverts to safe fallback
        expect(vars['--theme-secondary']).toBe('#3b82f6'); // Reverts to safe fallback
      });
    });

    describe('F5: Branded Transactional Email Templating', () => {
      it('F5-1: wraps notification body in agency header, colors, and footer', () => {
        const branding: BrandingSettings = {
          agencyName: 'HyperGrowth Agency',
          primaryColor: '#10b981',
          logoUrl: 'https://agency.com/logo.png',
        };

        const email = wrapWithAgencyBranding('<p>Your AI video is rendered!</p>', branding);
        expect(email).toContain('HyperGrowth Agency');
        expect(email).toContain('https://agency.com/logo.png');
        expect(email).toContain('#10b981');
        expect(email).toContain('Your AI video is rendered!');
        expect(email).toContain('Powered by Sophia Enterprise Scale Engine');
      });

      it('F5-2: escapes HTML meta-characters in agencyName to prevent XSS injection', () => {
        const branding: BrandingSettings = {
          agencyName: '<script>alert("xss")</script> Agency',
        };
        const email = wrapWithAgencyBranding('<p>Welcome</p>', branding);
        expect(email).not.toContain('<script>alert("xss")</script>');
        expect(email).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; Agency');
      });

      it('F5-3: gracefully renders when logo is omitted', () => {
        const branding: BrandingSettings = {
          agencyName: 'Simple Brand',
        };
        const email = wrapWithAgencyBranding('<p>Notice</p>', branding);
        expect(email).not.toContain('<img');
        expect(email).toContain('Simple Brand');
      });

      it('F5-4: defaults to Sophia AI Factory branding when branding input is empty', () => {
        const email = wrapWithAgencyBranding('<p>Default notification</p>', {});
        expect(email).toContain('Sophia AI Factory');
        expect(email).toContain('#0f172a');
      });

      it('F5-5: preserves raw inner HTML formatting and links', () => {
        const content = '<div>Click <a href="https://example.com/view">here</a> to view video.</div>';
        const email = wrapWithAgencyBranding(content, { agencyName: 'Test Agency' });
        expect(email).toContain(content);
      });
    });
  });

  // ============================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 tests)
  // ============================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('B1: rejects duplicate hostname registration across the system', async () => {
      await registerCustomDomain(db, testOrgId, 'unique.agency.com');
      await expect(
        registerCustomDomain(db, secondOrgId, 'unique.agency.com')
      ).rejects.toThrow(/DOMAIN_ALREADY_EXISTS/);
    });

    it('B2: rejects duplicate hostname even with mixed case or trailing spaces', async () => {
      await registerCustomDomain(db, testOrgId, 'test.client.com');
      await expect(
        registerCustomDomain(db, secondOrgId, '  TEST.CLIENT.COM  ')
      ).rejects.toThrow(/DOMAIN_ALREADY_EXISTS/);
    });

    it('B3: rejects invalid hostnames (IP addresses, missing TLD, invalid chars)', async () => {
      expect(isValidHostname('192.168.1.1')).toBe(false);
      expect(isValidHostname('invalid_underscore.domain.com')).toBe(false);
      expect(isValidHostname('domainwithouttld')).toBe(false);
      expect(isValidHostname('')).toBe(false);
      expect(isValidHostname('a'.repeat(254) + '.com')).toBe(false);
      expect(isValidHostname('localhost')).toBe(false);
      expect(isValidHostname('app.localhost')).toBe(false);

      await expect(
        registerCustomDomain(db, testOrgId, 'bad_domain.com')
      ).rejects.toThrow(/INVALID_HOSTNAME/);
    });

    it('B4: handles domain verification error with detailed diagnostics', async () => {
      const domain = await registerCustomDomain(db, testOrgId, 'failing.domain.com');
      const verified = await verifyCustomDomainStatus(db, domain.id, {
        cnameValid: false,
        sslActive: false,
        errorMessage: 'SSL_CERTIFICATE_AUTHORIZATION_FAILED: Hostname not pointing to CNAME target',
      });

      expect(verified.status).toBe('error');
      expect(verified.sslStatus).toBe('error');
      expect(verified.errorMessage).toContain('SSL_CERTIFICATE_AUTHORIZATION_FAILED');

      // Verify DB record matches
      const inDb = await db
        .prepare('SELECT status, error_message FROM custom_domains WHERE id = ?1')
        .bind(domain.id)
        .first<{ status: string; error_message: string }>();

      expect(inDb?.status).toBe('error');
      expect(inDb?.error_message).toContain('SSL_CERTIFICATE_AUTHORIZATION_FAILED');
    });

    it('B5: inactive or error-state domains are never resolved in edge routing', async () => {
      const domain = await registerCustomDomain(db, testOrgId, 'error.domain.com');
      await verifyCustomDomainStatus(db, domain.id, {
        cnameValid: false,
        sslActive: false,
        errorMessage: 'Fatal routing error',
      });

      const context = await resolveTenantFromHostname(db, 'error.domain.com');
      expect(context).toBeNull();
    });
  });

  // ============================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // ============================================================================
  describe('Tier 3: Cross-Feature Combinations', () => {
    it('P1: multiple organizations have completely isolated hostnames and theme settings', async () => {
      // Register domain for Org 1
      const dom1 = await registerCustomDomain(db, testOrgId, 'portal.org1.com');
      await verifyCustomDomainStatus(db, dom1.id, { cnameValid: true, sslActive: true });
      await db
        .prepare(
          `INSERT INTO org_branding (org_id, agency_name, primary_color, created_at, updated_at)
           VALUES (?1, 'Agency 1', '#111111', ?2, ?2)`
        )
        .bind(testOrgId, Date.now())
        .run();

      // Register domain for Org 2
      const dom2 = await registerCustomDomain(db, secondOrgId, 'portal.org2.com');
      await verifyCustomDomainStatus(db, dom2.id, { cnameValid: true, sslActive: true });
      await db
        .prepare(
          `INSERT INTO org_branding (org_id, agency_name, primary_color, created_at, updated_at)
           VALUES (?1, 'Agency 2', '#222222', ?2, ?2)`
        )
        .bind(secondOrgId, Date.now())
        .run();

      const res1 = await resolveTenantFromHostname(db, 'portal.org1.com');
      const res2 = await resolveTenantFromHostname(db, 'portal.org2.com');

      expect(res1?.orgId).toBe(testOrgId);
      expect(res1?.branding.agencyName).toBe('Agency 1');
      expect(res1?.branding.primaryColor).toBe('#111111');

      expect(res2?.orgId).toBe(secondOrgId);
      expect(res2?.branding.agencyName).toBe('Agency 2');
      expect(res2?.branding.primaryColor).toBe('#222222');
    });

    it('P2: dynamic CSS variables and email templates stay in sync when branding is updated', async () => {
      const initialBranding: BrandingSettings = {
        agencyName: 'V1 Agency',
        primaryColor: '#aaaaaa',
      };

      const css1 = resolveThemeCssVariables(initialBranding);
      const email1 = wrapWithAgencyBranding('<p>V1</p>', initialBranding);
      expect(css1['--theme-primary']).toBe('#aaaaaa');
      expect(email1).toContain('V1 Agency');

      // Update branding
      const updatedBranding: BrandingSettings = {
        agencyName: 'V2 Agency Rebranded',
        primaryColor: '#bbbbbb',
      };

      const css2 = resolveThemeCssVariables(updatedBranding);
      const email2 = wrapWithAgencyBranding('<p>V2</p>', updatedBranding);
      expect(css2['--theme-primary']).toBe('#bbbbbb');
      expect(email2).toContain('V2 Agency Rebranded');
    });
  });

  // ============================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ============================================================================
  describe('Tier 4: Real-World Scenarios', () => {
    it('S1: complete Agency White-Label Onboarding Journey', async () => {
      // Step 1: Agency registers custom domain
      const domain = await registerCustomDomain(db, testOrgId, 'creator.growthscale.io');
      expect(domain.status).toBe('pending_validation');
      expect(domain.cname_target).toBe('cname.sophia.agencyos.network');

      // Step 2: Edge resolution before verification returns null (safety check)
      const earlyResolve = await resolveTenantFromHostname(db, 'creator.growthscale.io');
      expect(earlyResolve).toBeNull();

      // Step 3: Cloudflare for SaaS validates DNS CNAME & provisions SSL certificate
      const verification = await verifyCustomDomainStatus(db, domain.id, {
        cnameValid: true,
        sslActive: true,
      });
      expect(verification.isVerified).toBe(true);
      expect(verification.status).toBe('active');

      // Step 4: Agency saves portal branding in dashboard
      await db
        .prepare(
          `INSERT INTO org_branding
           (org_id, agency_name, portal_title, logo_url, primary_color, secondary_color, created_at, updated_at)
           VALUES (?1, 'GrowthScale AI', 'GrowthScale Portal', 'https://growthscale.io/logo.png', '#4f46e5', '#06b6d4', ?2, ?2)`
        )
        .bind(testOrgId, Date.now())
        .run();

      // Step 5: Live edge request to 'creator.growthscale.io' resolves agency context
      const liveContext = await resolveTenantFromHostname(db, 'creator.growthscale.io');
      expect(liveContext).not.toBeNull();
      expect(liveContext?.orgId).toBe(testOrgId);

      // Step 6: Dynamic theme injection populates portal CSS variables
      const themeCss = resolveThemeCssVariables(liveContext!.branding);
      expect(themeCss['--theme-primary']).toBe('#4f46e5');
      expect(themeCss['--theme-secondary']).toBe('#06b6d4');
      expect(themeCss['--theme-portal-title']).toBe('"GrowthScale Portal"');

      // Step 7: System sends agency-branded onboarding transactional email to client
      const welcomeEmail = wrapWithAgencyBranding(
        '<h3>Welcome to your dedicated AI creative portal!</h3><p>Your team is ready to produce automated videos.</p>',
        liveContext!.branding
      );
      expect(welcomeEmail).toContain('GrowthScale AI');
      expect(welcomeEmail).toContain('#4f46e5');
      expect(welcomeEmail).toContain('https://growthscale.io/logo.png');
      expect(welcomeEmail).toContain('Welcome to your dedicated AI creative portal!');
    });
  });
});
