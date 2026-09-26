/**
 * Unit Tests for Custom Domains Engine & Cloudflare for SaaS Verification.
 *
 * Covers:
 * 1. Hostname validation (RFC 1035/1123, length, reserved domain guard)
 * 2. Cloudflare SaaS verification record parsers (ownership TXT, SSL DCV, errors)
 * 3. SSL & CNAME lifecycle state transitions (pending, deployment, active, error, revoked)
 * 4. D1 row mapper serialization & null/error resilience
 * 5. Hostname resolver normalization, canonical detection, and header injection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validateHostname } from '@/tree/custom-domains/verification-service';
import {
  parseOwnershipVerification,
  parseSslDcvVerification,
  parseVerificationErrors,
  evaluateStatusTransitions,
  mapRowToCustomDomainRecord,
  DEFAULT_CNAME_TARGET,
} from '@/tree/custom-domains/verification-service';
import {
  normalizeHostname,
  isInternalOrCanonicalHostname,
  extractHostname,
  injectTenantRoutingHeaders,
  getTenantOrgId,
  getCustomDomain,
  isWhitelabelActive,
  clearHostnameCache,
} from '@/tree/custom-domains/hostname-resolver';
import type { CloudflareCustomHostnameResult, CustomDomainRow } from '@/seed/types/custom-domains';

describe('Custom Domains Engine — Unit Tests', () => {
  beforeEach(() => {
    clearHostnameCache();
  });

  describe('1. Hostname Validation', () => {
    it('accepts valid fully qualified domain names', () => {
      const validCases = [
        'portal.myagency.com',
        'app.video-creators.io',
        'sub.domain.co.uk',
        'studio.agency.vn',
        'alpha-1.beta-2.agency.org',
      ];

      for (const hostname of validCases) {
        const result = validateHostname(hostname);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(hostname.toLowerCase());
        }
      }
    });

    it('trims whitespace and normalizes to lowercase', () => {
      const result = validateHostname('  PORTAL.MyAgency.COM  ');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('portal.myagency.com');
      }
    });

    it('rejects hostnames that are too short or too long', () => {
      expect(validateHostname('').ok).toBe(false);
      expect(validateHostname('a.b').ok).toBe(false); // < 4 chars
      expect(validateHostname('a'.repeat(250) + '.com').ok).toBe(false); // > 253 chars
    });

    it('rejects malformed hostnames with invalid characters', () => {
      const invalidCases = [
        '-portal.agency.com',
        'portal-.agency.com',
        'portal..agency.com',
        'portal.-agency.com',
        'portal.agency-.com',
        'portal.-.com',
        'portal.agency.com-',
        'http://portal.agency.com',
        'portal.agency.com:8080',
        'portal/agency/com',
        'portal@agency.com',
        'portal agency.com',
      ];

      for (const invalid of invalidCases) {
        const result = validateHostname(invalid);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_HOSTNAME');
        }
      }
    });

    it('rejects reserved platform domains and suffixes', () => {
      const forbidden = [
        'sophia.agencyos.network',
        'sub.sophia.agencyos.network',
        'agencyos.network',
        'portal.agencyos.network',
        'localhost',
        'app.localhost',
        'workers.dev',
        'my-tenant.workers.dev',
        'pages.dev',
        'my-agency.pages.dev',
      ];

      for (const host of forbidden) {
        const result = validateHostname(host);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_HOSTNAME');
        }
      }
    });
  });

  describe('2. Cloudflare SaaS Verification Record Parsers', () => {
    it('parses ownership TXT verification record', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'pending',
        ownership_verification: {
          type: 'txt',
          name: '_cf-custom-hostname.portal.client.com',
          value: 'verification-token-abc-123',
        },
        ssl: { status: 'pending_validation' },
      };

      const record = parseOwnershipVerification(mockResult);
      expect(record).toEqual({
        type: 'txt',
        name: '_cf-custom-hostname.portal.client.com',
        value: 'verification-token-abc-123',
      });
    });

    it('returns null when ownership verification is absent', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'pending',
        ssl: { status: 'pending_validation' },
      };

      expect(parseOwnershipVerification(mockResult)).toBeNull();
    });

    it('parses SSL DCV validation records from validation_records array', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'pending',
        ssl: {
          status: 'pending_validation',
          validation_records: [
            {
              status: 'pending',
              txt_name: '_acme-challenge.portal.client.com',
              txt_value: 'dcv-token-xyz-789',
            },
          ],
        },
      };

      const dcv = parseSslDcvVerification(mockResult);
      expect(dcv).toEqual({
        type: 'txt',
        name: '_acme-challenge.portal.client.com',
        value: 'dcv-token-xyz-789',
      });
    });

    it('falls back to top-level SSL txt properties if validation_records is empty', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'pending',
        ssl: {
          status: 'pending_validation',
          txt_name: '_acme-challenge.portal.client.com',
          txt_value: 'fallback-token',
        },
      };

      const dcv = parseSslDcvVerification(mockResult);
      expect(dcv).toEqual({
        type: 'txt',
        name: '_acme-challenge.portal.client.com',
        value: 'fallback-token',
      });
    });

    it('parses verification error strings cleanly', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'pending',
        verification_errors: ['CAA record forbids issuance', '  ', 'Timeout querying DNS  '],
        ssl: { status: 'error' },
      };

      const errors = parseVerificationErrors(mockResult);
      expect(errors).toEqual(['CAA record forbids issuance', 'Timeout querying DNS']);
    });
  });

  describe('3. SSL & CNAME Lifecycle State Transitions', () => {
    it('evaluates pending_validation state when SSL is pending', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'pending',
        ssl: { status: 'pending_validation' },
      };

      const state = evaluateStatusTransitions(mockResult);
      expect(state.sslStatus).toBe('pending_validation');
      expect(state.verificationStatus).toBe('pending');
      expect(state.cnameVerified).toBe(false);
      expect(state.active).toBe(false);
      expect(state.errors).toEqual([]);
    });

    it('evaluates pending_deployment state when SSL is deploying', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'pending',
        ssl: { status: 'pending_deployment' },
      };

      const state = evaluateStatusTransitions(mockResult);
      expect(state.sslStatus).toBe('pending_deployment');
      expect(state.verificationStatus).toBe('verified');
      expect(state.cnameVerified).toBe(false);
      expect(state.active).toBe(false);
    });

    it('evaluates active state only when both SSL and custom host are active', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'active',
        ssl: { status: 'active' },
      };

      const state = evaluateStatusTransitions(mockResult);
      expect(state.sslStatus).toBe('active');
      expect(state.verificationStatus).toBe('active');
      expect(state.cnameVerified).toBe(true);
      expect(state.active).toBe(true);
      expect(state.errors).toEqual([]);
    });

    it('evaluates error state and preserves error messages', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'pending',
        verification_errors: ['DCV DNS query failed'],
        ssl: { status: 'error' },
      };

      const state = evaluateStatusTransitions(mockResult);
      expect(state.sslStatus).toBe('error');
      expect(state.verificationStatus).toBe('failed');
      expect(state.cnameVerified).toBe(false);
      expect(state.active).toBe(false);
      expect(state.errors).toContain('DCV DNS query failed');
    });

    it('evaluates revoked state accurately', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'blocked',
        ssl: { status: 'revoked' },
      };

      const state = evaluateStatusTransitions(mockResult);
      expect(state.sslStatus).toBe('revoked');
      expect(state.verificationStatus).toBe('revoked');
      expect(state.active).toBe(false);
    });

    it('evaluates blocked host status as error and failed', () => {
      const mockResult: CloudflareCustomHostnameResult = {
        id: 'cf_123',
        hostname: 'portal.client.com',
        status: 'blocked',
        ssl: { status: 'pending_validation' },
      };

      const state = evaluateStatusTransitions(mockResult);
      expect(state.sslStatus).toBe('error');
      expect(state.verificationStatus).toBe('failed');
      expect(state.cnameVerified).toBe(false);
      expect(state.active).toBe(false);
      expect(state.errors).toContain('Hostname is blocked by Cloudflare');
    });
  });

  describe('4. D1 Row Mapping and Serialization', () => {
    it('deserializes complete database row correctly', () => {
      const row: CustomDomainRow = {
        id: 'dom_12345',
        org_id: 'org_abc',
        hostname: 'portal.client.com',
        cf_custom_hostname_id: 'cf_uuid_999',
        ssl_status: 'active',
        verification_status: 'active',
        verification_errors: '["warning note"]',
        ownership_verification: JSON.stringify({
          type: 'txt',
          name: '_cf-custom-hostname.portal.client.com',
          value: 'token1',
        }),
        ssl_verification: JSON.stringify({
          type: 'txt',
          name: '_acme-challenge.portal.client.com',
          value: 'token2',
        }),
        cname_target: 'cname.sophia.agencyos.network',
        cname_verified: 1,
        active: 1,
        created_at: 1700000000,
        updated_at: 1700000100,
      };

      const record = mapRowToCustomDomainRecord(row);
      expect(record.id).toBe('dom_12345');
      expect(record.org_id).toBe('org_abc');
      expect(record.hostname).toBe('portal.client.com');
      expect(record.ssl_status).toBe('active');
      expect(record.verification_status).toBe('active');
      expect(record.cname_verified).toBe(true);
      expect(record.active).toBe(true);
      expect(record.ownership_verification?.value).toBe('token1');
      expect(record.ssl_verification?.value).toBe('token2');
      expect(record.verification_errors).toEqual(['warning note']);
      expect(record.cname_target).toBe('cname.sophia.agencyos.network');
    });

    it('handles corrupted JSON in verification fields without throwing', () => {
      const row: CustomDomainRow = {
        id: 'dom_12345',
        org_id: 'org_abc',
        hostname: 'portal.client.com',
        cf_custom_hostname_id: null,
        ssl_status: 'pending_validation',
        verification_errors: '{not an array',
        ownership_verification: 'not json',
        ssl_verification: '{"incomplete"',
        cname_target: '',
        cname_verified: 0,
        active: 0,
        created_at: 1700000000,
        updated_at: 1700000000,
      };

      const record = mapRowToCustomDomainRecord(row);
      expect(record.verification_errors).toEqual([]);
      expect(record.ownership_verification).toBeNull();
      expect(record.ssl_verification).toBeNull();
      expect(record.cname_target).toBe(DEFAULT_CNAME_TARGET);
      expect(record.cname_verified).toBe(false);
      expect(record.active).toBe(false);
    });
  });

  describe('5. Hostname Resolver Edge Helpers', () => {
    it('normalizes hostnames by stripping protocol, paths, and ports', () => {
      expect(normalizeHostname('HTTP://Portal.MyAgency.COM:8080/dashboard')).toBe('portal.myagency.com');
      expect(normalizeHostname('https://portal.myagency.com/')).toBe('portal.myagency.com');
      expect(normalizeHostname('[::1]:3000')).toBe('::1');
      expect(normalizeHostname('domain.com.')).toBe('domain.com');
      expect(normalizeHostname(null)).toBe('');
    });

    it('detects platform internal / canonical domains', () => {
      expect(isInternalOrCanonicalHostname('sophia.agencyos.network')).toBe(true);
      expect(isInternalOrCanonicalHostname('app.agencyos.network')).toBe(true);
      expect(isInternalOrCanonicalHostname('localhost')).toBe(true);
      expect(isInternalOrCanonicalHostname('sub.localhost')).toBe(true);
      expect(isInternalOrCanonicalHostname('127.0.0.1')).toBe(true);
      expect(isInternalOrCanonicalHostname('0.0.0.0')).toBe(true);
      expect(isInternalOrCanonicalHostname('feature-123.pages.dev')).toBe(true);
      expect(isInternalOrCanonicalHostname('sophia-worker.workers.dev')).toBe(true);

      // Customer custom domains are NOT internal
      expect(isInternalOrCanonicalHostname('portal.myagency.com')).toBe(false);
      expect(isInternalOrCanonicalHostname('media.agency.vn')).toBe(false);
    });

    it('extracts hostname from headers prioritizing x-forwarded-host', () => {
      const headers = new Headers({
        host: 'internal-edge.cloudflare.com',
        'x-forwarded-host': 'portal.myagency.com, edge.proxy.com',
      });

      expect(extractHostname(headers)).toBe('portal.myagency.com');
    });

    it('extracts hostname from Request object', () => {
      const req = new Request('https://portal.myagency.com:443/login', {
        headers: { host: 'portal.myagency.com' },
      });

      expect(extractHostname(req)).toBe('portal.myagency.com');
    });

    it('injects tenant routing headers correctly', () => {
      const headers = new Headers();
      injectTenantRoutingHeaders(headers, {
        isInternal: false,
        isCustomDomain: true,
        tenantOrgId: 'org_test_999',
        customDomain: 'portal.myagency.com',
        whitelabelActive: true,
        sslStatus: 'active',
      });

      expect(getTenantOrgId(headers)).toBe('org_test_999');
      expect(getCustomDomain(headers)).toBe('portal.myagency.com');
      expect(isWhitelabelActive(headers)).toBe(true);
    });

    it('sets x-whitelabel-active to false when domain SSL is not active', () => {
      const headers = new Headers();
      injectTenantRoutingHeaders(headers, {
        isInternal: false,
        isCustomDomain: true,
        tenantOrgId: 'org_test_999',
        customDomain: 'portal.myagency.com',
        whitelabelActive: false,
        sslStatus: 'pending_validation',
      });

      expect(getTenantOrgId(headers)).toBe('org_test_999');
      expect(getCustomDomain(headers)).toBe('portal.myagency.com');
      expect(isWhitelabelActive(headers)).toBe(false);
    });
  });
});
