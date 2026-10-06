/**
 * Unit Test Suite: AGY Domain Router & Subdomain Classifier
 *
 * Tests pure deterministic hostname parsing, subdomain classification,
 * reserved platform subdomain partitioning, and agency slug validation.
 *
 * Layer: tree/agy/__tests__
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeHostname,
  partitionReservedSubdomains,
  isValidAgencySlug,
  classifySubdomain,
  resolveAgencySlugFromHostname,
  isAgencySubdomain,
  parseHostnames,
  resolveTenantRoutingMetadata,
  RESERVED_PLATFORM_SUBDOMAINS,
  CANONICAL_NETWORK_DOMAIN,
} from '../domain-router';

describe('AGY Domain Router', () => {
  describe('normalizeHostname', () => {
    it('normalizes uppercase hostnames to lowercase and trims whitespace', () => {
      expect(normalizeHostname('  ACME.AGENCYOS.NETWORK  ')).toBe('acme.agencyos.network');
    });

    it('strips http and https protocols', () => {
      expect(normalizeHostname('http://portal.acme.com')).toBe('portal.acme.com');
      expect(normalizeHostname('https://portal.acme.com')).toBe('portal.acme.com');
    });

    it('strips ports from hostname', () => {
      expect(normalizeHostname('acme.agencyos.network:8080')).toBe('acme.agencyos.network');
      expect(normalizeHostname('localhost:3000')).toBe('localhost');
      expect(normalizeHostname('[::1]:8443')).toBe('::1');
    });

    it('strips trailing paths and trailing DNS dots', () => {
      expect(normalizeHostname('acme.agencyos.network/api/v1')).toBe('acme.agencyos.network');
      expect(normalizeHostname('acme.agencyos.network...')).toBe('acme.agencyos.network');
    });

    it('defensively handles null, undefined, or empty string', () => {
      expect(normalizeHostname(null)).toBe('');
      expect(normalizeHostname(undefined)).toBe('');
      expect(normalizeHostname('')).toBe('');
    });
  });

  describe('partitionReservedSubdomains', () => {
    it('identifies platform reserved subdomains correctly', () => {
      expect(partitionReservedSubdomains('sophia')).toBe(true);
      expect(partitionReservedSubdomains('api')).toBe(true);
      expect(partitionReservedSubdomains('admin')).toBe(true);
      expect(partitionReservedSubdomains('portal')).toBe(true);
      expect(partitionReservedSubdomains('sub')).toBe(true);
      expect(partitionReservedSubdomains('preview')).toBe(true);
      expect(partitionReservedSubdomains('workers')).toBe(true);
      expect(partitionReservedSubdomains('pages')).toBe(true);
      expect(partitionReservedSubdomains('www')).toBe(true);
      expect(partitionReservedSubdomains('app')).toBe(true);
      expect(partitionReservedSubdomains('status')).toBe(true);
      expect(partitionReservedSubdomains('docs')).toBe(true);
    });

    it('allows non-reserved customer agency slugs', () => {
      expect(partitionReservedSubdomains('acme')).toBe(false);
      expect(partitionReservedSubdomains('viral-media')).toBe(false);
      expect(partitionReservedSubdomains('tokyo-creators')).toBe(false);
      expect(partitionReservedSubdomains('agency123')).toBe(false);
    });

    it('treats empty or whitespace string as reserved/unsafe', () => {
      expect(partitionReservedSubdomains('')).toBe(true);
      expect(partitionReservedSubdomains('   ')).toBe(true);
    });
  });

  describe('isValidAgencySlug', () => {
    it('accepts valid alphanumeric and hyphenated slugs', () => {
      expect(isValidAgencySlug('acme')).toBe(true);
      expect(isValidAgencySlug('growth-lab')).toBe(true);
      expect(isValidAgencySlug('video-ai-factory')).toBe(true);
      expect(isValidAgencySlug('studio99')).toBe(true);
    });

    it('rejects slugs shorter than 2 characters or longer than 63 characters', () => {
      expect(isValidAgencySlug('a')).toBe(false);
      expect(isValidAgencySlug('a'.repeat(64))).toBe(false);
      expect(isValidAgencySlug('a'.repeat(63))).toBe(true);
    });

    it('rejects slugs starting or ending with hyphens', () => {
      expect(isValidAgencySlug('-acme')).toBe(false);
      expect(isValidAgencySlug('acme-')).toBe(false);
      expect(isValidAgencySlug('-acme-')).toBe(false);
    });

    it('rejects reserved platform subdomains', () => {
      expect(isValidAgencySlug('sophia')).toBe(false);
      expect(isValidAgencySlug('api')).toBe(false);
      expect(isValidAgencySlug('admin')).toBe(false);
      expect(isValidAgencySlug('portal')).toBe(false);
      expect(isValidAgencySlug('sub')).toBe(false);
      expect(isValidAgencySlug('login')).toBe(false);
    });

    it('rejects special characters, uppercase, and spaces', () => {
      expect(isValidAgencySlug('acme_studio')).toBe(false);
      expect(isValidAgencySlug('acme.studio')).toBe(false);
      expect(isValidAgencySlug('AcmeStudio')).toBe(false);
      expect(isValidAgencySlug('acme studio')).toBe(false);
      expect(isValidAgencySlug('acme@studio')).toBe(false);
    });
  });

  describe('classifySubdomain', () => {
    it('classifies localhost and loopbacks', () => {
      expect(classifySubdomain('localhost')).toEqual({
        type: 'localhost',
        slug: null,
        normalized: 'localhost',
      });
      expect(classifySubdomain('127.0.0.1:3000')).toEqual({
        type: 'localhost',
        slug: null,
        normalized: '127.0.0.1',
      });
      expect(classifySubdomain('0.0.0.0')).toEqual({
        type: 'localhost',
        slug: null,
        normalized: '0.0.0.0',
      });
    });

    it('classifies canonical platform domains', () => {
      expect(classifySubdomain('agencyos.network')).toEqual({
        type: 'canonical',
        slug: null,
        normalized: 'agencyos.network',
      });
      expect(classifySubdomain('sophia.agencyos.network')).toEqual({
        type: 'canonical',
        slug: null,
        normalized: 'sophia.agencyos.network',
      });
      expect(classifySubdomain('deep.nested.agencyos.network')).toEqual({
        type: 'canonical',
        slug: null,
        normalized: 'deep.nested.agencyos.network',
      });
      expect(classifySubdomain('preview.pages.dev')).toEqual({
        type: 'canonical',
        slug: null,
        normalized: 'preview.pages.dev',
      });
      expect(classifySubdomain('worker.workers.dev')).toEqual({
        type: 'canonical',
        slug: null,
        normalized: 'worker.workers.dev',
      });
    });

    it('classifies reserved platform subdomains on agencyos.network', () => {
      expect(classifySubdomain('sub.agencyos.network')).toEqual({
        type: 'reserved_subdomain',
        slug: 'sub',
        normalized: 'sub.agencyos.network',
      });
      expect(classifySubdomain('admin.agencyos.network')).toEqual({
        type: 'reserved_subdomain',
        slug: 'admin',
        normalized: 'admin.agencyos.network',
      });
      expect(classifySubdomain('portal.agencyos.network')).toEqual({
        type: 'reserved_subdomain',
        slug: 'portal',
        normalized: 'portal.agencyos.network',
      });
      expect(classifySubdomain('api.agencyos.network')).toEqual({
        type: 'reserved_subdomain',
        slug: 'api',
        normalized: 'api.agencyos.network',
      });
    });

    it('classifies genuine agency tenant subdomains', () => {
      expect(classifySubdomain('acme.agencyos.network')).toEqual({
        type: 'agency_subdomain',
        slug: 'acme',
        normalized: 'acme.agencyos.network',
      });
      expect(classifySubdomain('growth-hq.agencyos.network:443')).toEqual({
        type: 'agency_subdomain',
        slug: 'growth-hq',
        normalized: 'growth-hq.agencyos.network',
      });
      expect(classifySubdomain('studio-apac.agencyos.network')).toEqual({
        type: 'agency_subdomain',
        slug: 'studio-apac',
        normalized: 'studio-apac.agencyos.network',
      });
    });

    it('classifies external custom domains', () => {
      expect(classifySubdomain('videoagency.com')).toEqual({
        type: 'custom_domain',
        slug: null,
        normalized: 'videoagency.com',
      });
      expect(classifySubdomain('portal.creatorstudio.io')).toEqual({
        type: 'custom_domain',
        slug: null,
        normalized: 'portal.creatorstudio.io',
      });
      expect(classifySubdomain('agency.vn')).toEqual({
        type: 'custom_domain',
        slug: null,
        normalized: 'agency.vn',
      });
    });
  });

  describe('resolveAgencySlugFromHostname', () => {
    it('resolves valid agency slug from agency subdomain', () => {
      expect(resolveAgencySlugFromHostname('alpha.agencyos.network')).toBe('alpha');
      expect(resolveAgencySlugFromHostname('beta-agency.agencyos.network:8443')).toBe('beta-agency');
    });

    it('returns null for reserved subdomains', () => {
      expect(resolveAgencySlugFromHostname('sophia.agencyos.network')).toBeNull();
      expect(resolveAgencySlugFromHostname('api.agencyos.network')).toBeNull();
      expect(resolveAgencySlugFromHostname('admin.agencyos.network')).toBeNull();
      expect(resolveAgencySlugFromHostname('sub.agencyos.network')).toBeNull();
    });

    it('returns null for base domain, localhost, and custom domains', () => {
      expect(resolveAgencySlugFromHostname('agencyos.network')).toBeNull();
      expect(resolveAgencySlugFromHostname('localhost')).toBeNull();
      expect(resolveAgencySlugFromHostname('customagency.com')).toBeNull();
    });
  });

  describe('isAgencySubdomain', () => {
    it('returns true only for non-reserved agency subdomains', () => {
      expect(isAgencySubdomain('acme.agencyos.network')).toBe(true);
      expect(isAgencySubdomain('growth.agencyos.network')).toBe(true);
      expect(isAgencySubdomain('sub.agencyos.network')).toBe(false);
      expect(isAgencySubdomain('sophia.agencyos.network')).toBe(false);
      expect(isAgencySubdomain('customagency.com')).toBe(false);
    });
  });

  describe('parseHostnames & resolveTenantRoutingMetadata', () => {
    it('parses agency subdomain with comprehensive metadata', () => {
      const parsed = parseHostnames('https://titan-media.agencyos.network:3000/dashboard');
      expect(parsed).toEqual({
        normalized: 'titan-media.agencyos.network',
        isAgencySubdomain: true,
        agencySlug: 'titan-media',
        isReserved: false,
        isCustomDomain: false,
        isCanonical: false,
      });

      const meta = resolveTenantRoutingMetadata('titan-media.agencyos.network');
      expect(meta.isAgencySubdomain).toBe(true);
      expect(meta.agencySlug).toBe('titan-media');
      expect(meta.isInternal).toBe(false);
      expect(meta.isCustomDomain).toBe(false);
    });

    it('parses platform canonical with proper flags', () => {
      const parsed = parseHostnames('sophia.agencyos.network');
      expect(parsed.isCanonical).toBe(true);
      expect(parsed.isAgencySubdomain).toBe(false);
      expect(parsed.agencySlug).toBeNull();

      const meta = resolveTenantRoutingMetadata('sophia.agencyos.network');
      expect(meta.isInternal).toBe(true);
    });

    it('parses customer custom domain with proper flags', () => {
      const parsed = parseHostnames('studio.hypergrowth.vn');
      expect(parsed.isCustomDomain).toBe(true);
      expect(parsed.isAgencySubdomain).toBe(false);
      expect(parsed.agencySlug).toBeNull();

      const meta = resolveTenantRoutingMetadata('studio.hypergrowth.vn');
      expect(meta.isCustomDomain).toBe(true);
      expect(meta.isInternal).toBe(false);
    });
  });
});
