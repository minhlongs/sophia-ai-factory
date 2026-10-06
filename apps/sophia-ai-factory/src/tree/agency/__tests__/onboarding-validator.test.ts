import { describe, it, expect } from 'vitest';
import {
  validateAgencySlug,
  validateHexColor,
  validateCustomDomain,
  sanitizeCustomCss,
  validateSeedAgentConfig,
  validateProfileStep,
  validateBrandingStep,
  validateDomainStep,
  validateSeedAgentsStep,
  validateCompleteSubmission,
  RESERVED_SLUGS,
} from '../onboarding-validator';
import type { AgencyOnboardingSubmission, SeedAgentDeploymentConfig } from '@/seed/types';

describe('Agency Onboarding Validator & Sanitizer', () => {
  describe('validateAgencySlug', () => {
    it('accepts valid alphanumeric kebab-case slugs', () => {
      expect(validateAgencySlug('acme-studios').valid).toBe(true);
      expect(validateAgencySlug('agency123').valid).toBe(true);
      expect(validateAgencySlug('viet-media-group').valid).toBe(true);
    });

    it('rejects slugs that are too short or too long', () => {
      const short = validateAgencySlug('ab');
      expect(short.valid).toBe(false);
      expect(short.errors).toContain('SLUG_TOO_SHORT');

      const long = validateAgencySlug('a'.repeat(49));
      expect(long.valid).toBe(false);
      expect(long.errors).toContain('SLUG_TOO_LONG');
    });

    it('rejects invalid characters, uppercase, and double hyphens', () => {
      expect(validateAgencySlug('Acme-Agency').valid).toBe(true); // Normalized to lowercase
      expect(validateAgencySlug('acme_agency').valid).toBe(false);
      expect(validateAgencySlug('acme--agency').valid).toBe(false);
      expect(validateAgencySlug('-acme').valid).toBe(false);
      expect(validateAgencySlug('acme-').valid).toBe(false);
    });

    it('rejects reserved platform slugs', () => {
      for (const reserved of Array.from(RESERVED_SLUGS)) {
        const res = validateAgencySlug(reserved);
        expect(res.valid).toBe(false);
        expect(res.errors).toContain('SLUG_RESERVED');
      }
    });

    it('handles null, undefined, and non-string inputs', () => {
      expect(validateAgencySlug(null as unknown as string).valid).toBe(false);
      expect(validateAgencySlug(undefined as unknown as string).valid).toBe(false);
    });
  });

  describe('validateHexColor', () => {
    it('accepts valid 6-character and 3-character hex colors', () => {
      expect(validateHexColor('#3b82f6')).toBe('#3b82f6');
      expect(validateHexColor('#FFF')).toBe('#fff');
      expect(validateHexColor('#10b981')).toBe('#10b981');
    });

    it('falls back safely when color is invalid or empty', () => {
      expect(validateHexColor('red', '#000000')).toBe('#000000');
      expect(validateHexColor('#12345', '#3b82f6')).toBe('#3b82f6');
      expect(validateHexColor(null, '#3b82f6')).toBe('#3b82f6');
    });
  });

  describe('validateCustomDomain', () => {
    it('accepts valid FQDNs', () => {
      expect(validateCustomDomain('client.agencybrand.com').valid).toBe(true);
      expect(validateCustomDomain('sub.domain.co.uk').valid).toBe(true);
    });

    it('permits empty/null domain as optional', () => {
      expect(validateCustomDomain(null).valid).toBe(true);
      expect(validateCustomDomain('').valid).toBe(true);
    });

    it('rejects protocol injection schemes', () => {
      const res = validateCustomDomain('https://client.agency.com');
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('DOMAIN_CONTAINS_PROTOCOL');
    });

    it('rejects path and port inclusions', () => {
      const pathRes = validateCustomDomain('agency.com/portal');
      expect(pathRes.valid).toBe(false);
      expect(pathRes.errors).toContain('DOMAIN_CONTAINS_PATH');

      const portRes = validateCustomDomain('agency.com:8080');
      expect(portRes.valid).toBe(false);
      expect(portRes.errors).toContain('DOMAIN_CONTAINS_PORT');
    });
  });

  describe('sanitizeCustomCss', () => {
    it('strips script tags and comments', () => {
      const dirty = '<script>alert(1)</script>/* comment */body { color: red; }';
      const clean = sanitizeCustomCss(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('alert(1)');
      expect(clean).not.toContain('/* comment */');
      expect(clean).toContain('body { color: red; }');
    });

    it('strips dangerous CSS expressions and @import', () => {
      const dirty = '@import url("evil.css"); .bad { width: expression(document.body.clientWidth); }';
      const clean = sanitizeCustomCss(dirty);
      expect(clean).not.toContain('@import');
      expect(clean).not.toContain('expression(');
    });

    it('strips javascript: and vbscript: pseudo-protocols', () => {
      const dirty = 'background: url("javascript:alert(1)"); color: vbscript:run()';
      const clean = sanitizeCustomCss(dirty);
      expect(clean).not.toContain('javascript:');
      expect(clean).not.toContain('vbscript:');
    });
  });

  describe('validateSeedAgentConfig', () => {
    it('validates compliant seed agent configuration', () => {
      const config: SeedAgentDeploymentConfig = {
        agentId: 'agent-video-1',
        name: 'Video Creator Bot',
        role: 'video_creator',
        template: 'ai-avatar-video-agency',
        maxAutonomy: 'L2',
        maxComputeUnitsMcu: 500,
        escalationPolicy: 'request_approval',
        enabled: true,
      };
      expect(validateSeedAgentConfig(config).valid).toBe(true);
    });

    it('rejects invalid autonomy level and non-finite compute', () => {
      const config: SeedAgentDeploymentConfig = {
        agentId: 'agent-video-1',
        name: 'Video Creator Bot',
        role: 'video_creator',
        template: 'ai-avatar-video-agency',
        maxAutonomy: 'L9' as any,
        maxComputeUnitsMcu: -10,
        escalationPolicy: 'request_approval',
        enabled: true,
      };
      const res = validateSeedAgentConfig(config);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('INVALID_AUTONOMY_LEVEL');
      expect(res.errors).toContain('INVALID_COMPUTE_UNITS');
    });
  });

  describe('validateCompleteSubmission', () => {
    it('accepts complete, valid onboarding submission', () => {
      const submission: AgencyOnboardingSubmission = {
        agencyOrgId: 'org_agency_123',
        profile: {
          clientName: 'Alpha Media Agency',
          agencySlug: 'alpha-media',
          contactEmail: 'contact@alphamedia.vn',
          industryTag: 'ecommerce',
          initialMcuBudget: 1000,
        },
        branding: {
          primaryColor: '#2563eb',
          accentColor: '#f59e0b',
          logoUrl: 'https://cdn.agencyos.network/logo.png',
        },
        domain: {
          customDomain: 'media.alphaagency.com',
        },
        seedAgents: [
          {
            agentId: 'seed-vc-1',
            name: 'Video Creator',
            role: 'video_creator',
            template: 'ai-avatar-video-agency',
            maxAutonomy: 'L2',
            maxComputeUnitsMcu: 500,
            escalationPolicy: 'request_approval',
            enabled: true,
          },
        ],
      };

      const result = validateCompleteSubmission(submission);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.stepErrors)).toHaveLength(0);
    });

    it('collects step-by-step errors when multiple fields are invalid', () => {
      const badSubmission: AgencyOnboardingSubmission = {
        agencyOrgId: 'org_agency_123',
        profile: {
          clientName: '',
          agencySlug: 'admin', // reserved
          contactEmail: 'not-an-email',
          industryTag: 'general',
          initialMcuBudget: -5,
        },
        branding: {
          primaryColor: 'invalid-hex',
        },
        domain: {
          customDomain: 'https://bad-domain.com/path',
        },
        seedAgents: [],
      };

      const result = validateCompleteSubmission(badSubmission);
      expect(result.valid).toBe(false);
      expect(result.stepErrors.profile).toBeDefined();
      expect(result.stepErrors.branding).toBeDefined();
      expect(result.stepErrors.domain).toBeDefined();
      expect(result.stepErrors.seedAgents).toBeDefined();
    });
  });
});
