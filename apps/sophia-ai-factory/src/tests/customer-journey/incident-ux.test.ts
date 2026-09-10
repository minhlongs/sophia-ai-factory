import { describe, it, expect } from 'vitest';
import {
  classifyCustomerIncident,
  type IncidentCategory,
} from '@/land/production-monitoring/customer-health-summary';
import {
  generateDiagnosticBundle,
  sanitizeText,
  maskTenantId,
  classifyErrorToCategory,
} from '@/components/support/diagnostic-bundle-generator';

describe('Phase 9: Customer Incident UX & Diagnostic Safety', () => {
  describe('5 Safe Incident Classifications', () => {
    const INCIDENT_TEST_CASES: Array<{
      rawError: string;
      expectedCategory: IncidentCategory;
    }> = [
      { rawError: '401 Unauthorized: Invalid API key credentials provided', expectedCategory: 'KEY_EXPIRED_OR_INVALID' },
      { rawError: 'Authentication failed for ElevenLabs: Token expired', expectedCategory: 'KEY_EXPIRED_OR_INVALID' },
      { rawError: 'HTTP 429: Too Many Requests. Rate limit throttled by fal.ai', expectedCategory: 'PROVIDER_RATE_LIMIT' },
      { rawError: '402 Payment Required: Insufficient credit balance for mission', expectedCategory: 'QUOTA_EXHAUSTED' },
      { rawError: 'Upstream quota exhausted on OpenRouter model calls', expectedCategory: 'QUOTA_EXHAUSTED' },
      { rawError: 'ETIMEDOUT: Connection aborted while waiting for video compositing', expectedCategory: 'NETWORK_TIMEOUT' },
      { rawError: 'Safety filter triggered: NSFW or prompt format rejected', expectedCategory: 'ASSET_VALIDATION_FAILED' },
      { rawError: 'Asset validation failed: Unsupported image dimensions', expectedCategory: 'ASSET_VALIDATION_FAILED' },
    ];

    it.each(INCIDENT_TEST_CASES)('classifies "$rawError" as $expectedCategory', ({ rawError, expectedCategory }) => {
      const incident = classifyCustomerIncident(rawError);
      expect(incident.category).toBe(expectedCategory);
    });
  });

  describe('4 Standard Action Zones Structure', () => {
    it('verifies all 5 incident categories have complete bilingual 4 action zones', () => {
      const categories: IncidentCategory[] = [
        'KEY_EXPIRED_OR_INVALID',
        'PROVIDER_RATE_LIMIT',
        'QUOTA_EXHAUSTED',
        'NETWORK_TIMEOUT',
        'ASSET_VALIDATION_FAILED',
      ];

      for (const cat of categories) {
        const incident = classifyCustomerIncident(cat);
        // Zone 1: WHAT HAPPENED & WHAT IT MEANS
        expect(incident.whatHappened).toBeTruthy();
        expect(incident.whatHappenedVi).toBeTruthy();
        expect(incident.whatItMeans).toBeTruthy();
        expect(incident.whatItMeansVi).toBeTruthy();

        // Zone 2: WHAT YOU CAN DO
        expect(incident.whatYouCanDo).toBeTruthy();
        expect(incident.whatYouCanDoVi).toBeTruthy();

        // Zone 3: TRY AGAIN action URL
        expect(incident.retryActionUrl).toMatch(/^\//);

        // Zone 4: CONTACT SUPPORT link
        expect(incident.supportUrl).toBe('/operations');
      }
    });
  });

  describe('Sanitized Diagnostic Bundle Generator Security', () => {
    it('scrubs API keys, Bearer tokens, passwords, database URIs and emails from text', () => {
      const sensitiveLog = [
        'sk-live-1234567890abcdef1234567890',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID1234',
        'password: SuperSecretPass123!',
        'postgres://admin:secretPass@internal-db.cloud:5432/sophia_prod',
        'mysql://root:toor@127.0.0.1/db',
        'ceo@private-client.com',
      ].join(' -- ');

      const sanitized = sanitizeText(sensitiveLog);
      expect(sanitized).not.toContain('sk-live');
      expect(sanitized).not.toContain('SuperSecretPass');
      expect(sanitized).not.toContain('postgres://');
      expect(sanitized).not.toContain('mysql://');
      expect(sanitized).not.toContain('ceo@private-client.com');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('masks tenant ID preserving only non-sensitive suffix', () => {
      expect(maskTenantId('usr_org_abcdef987654')).toBe('usr_***987654');
      expect(maskTenantId('usr_12')).toBe('usr_***usr_12');
      expect(maskTenantId('')).toBe('usr_anon');
    });

    it('generates completely sanitized diagnostic bundle with zero secret leaks', () => {
      const rawErrors = [
        'Error: Connection to postgres://user:secret@db.internal:5432 failed at pool.connect (/app/dist/db.js:42:15)',
        'Upstream 401 Unauthorized for key sk-ant-api03-live-998877665544 at client.ts:88',
      ];

      const bundle = generateDiagnosticBundle({
        userId: 'usr_enterprise_client_334455',
        recentErrors: rawErrors,
        systemHealth: 'DEGRADED',
      });

      expect(bundle.verification.isSanitized).toBe(true);
      expect(bundle.verification.excludedElements).toEqual(
        expect.arrayContaining([
          'api_keys',
          'passwords',
          'database_connection_strings',
          'video_transcripts',
          'personally_identifiable_information',
        ]),
      );

      const serialized = JSON.stringify(bundle);
      expect(serialized).not.toContain('postgres://');
      expect(serialized).not.toContain('secret@db');
      expect(serialized).not.toContain('sk-ant');
      expect(serialized).not.toContain('/app/dist/db.js');

      expect(bundle.diagnostics.recentErrorCategories).toEqual([
        'GENERIC_OPERATIONAL_ERROR',
        'KEY_EXPIRED_OR_INVALID',
      ]);
      expect(bundle.tenant.maskedId).toBe('usr_***334455');
    });

    it('maps runtime exceptions to safe operational categories without stack traces', () => {
      expect(classifyErrorToCategory('FetchError: abort signal timeout')).toBe('NETWORK_TIMEOUT');
      expect(classifyErrorToCategory('Rate limit 429')).toBe('PROVIDER_RATE_LIMIT');
      expect(classifyErrorToCategory('Insufficient credits 402')).toBe('QUOTA_EXHAUSTED');
      expect(classifyErrorToCategory('Filter safety nsfw violation')).toBe('ASSET_VALIDATION_FAILED');
    });
  });
});
