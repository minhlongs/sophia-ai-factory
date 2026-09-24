import { describe, it, expect, beforeEach, vi } from 'vitest';
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
} from '../hostname-resolver';

describe('hostname-resolver', () => {
  beforeEach(() => {
    clearHostnameCache();
  });

  describe('normalizeHostname', () => {
    it('normalizes uppercase hostnames to lowercase and trims whitespace', () => {
      expect(normalizeHostname('  PORTAL.AgencyAlpha.COM  ')).toBe('portal.agencyalpha.com');
    });

    it('strips http and https protocols if present', () => {
      expect(normalizeHostname('https://portal.myagency.com')).toBe('portal.myagency.com');
      expect(normalizeHostname('http://client.videos.io')).toBe('client.videos.io');
    });

    it('strips port numbers from hostname', () => {
      expect(normalizeHostname('portal.myagency.com:3000')).toBe('portal.myagency.com');
      expect(normalizeHostname('localhost:8787')).toBe('localhost');
    });

    it('strips path if present', () => {
      expect(normalizeHostname('portal.agency.com/dashboard/sops')).toBe('portal.agency.com');
    });

    it('strips IPv6 brackets and trailing DNS dots', () => {
      expect(normalizeHostname('[2001:db8::1]:8080')).toBe('2001:db8::1');
      expect(normalizeHostname('portal.agency.com.')).toBe('portal.agency.com');
    });

    it('strips multiple trailing DNS dots completely', () => {
      expect(normalizeHostname('portal.agency.com...')).toBe('portal.agency.com');
      expect(normalizeHostname('sophia.agencyos.network..')).toBe('sophia.agencyos.network');
    });

    it('returns empty string for null, undefined, or empty input', () => {
      expect(normalizeHostname(null)).toBe('');
      expect(normalizeHostname(undefined)).toBe('');
      expect(normalizeHostname('')).toBe('');
    });
  });

  describe('isInternalOrCanonicalHostname', () => {
    it('identifies platform canonical domains', () => {
      expect(isInternalOrCanonicalHostname('sophia.agencyos.network')).toBe(true);
      expect(isInternalOrCanonicalHostname('sub.agencyos.network')).toBe(true);
      expect(isInternalOrCanonicalHostname('agencyos.network')).toBe(true);
    });

    it('identifies local development hostnames', () => {
      expect(isInternalOrCanonicalHostname('localhost')).toBe(true);
      expect(isInternalOrCanonicalHostname('sub.localhost')).toBe(true);
      expect(isInternalOrCanonicalHostname('127.0.0.1')).toBe(true);
      expect(isInternalOrCanonicalHostname('0.0.0.0')).toBe(true);
    });

    it('strictly checks IPv4 loopback using exact regex and rejects lookalike 127. prefixes', () => {
      expect(isInternalOrCanonicalHostname('127.0.0.1')).toBe(true);
      expect(isInternalOrCanonicalHostname('127.255.255.254')).toBe(true);
      expect(isInternalOrCanonicalHostname('127.0.0.1.attacker.com')).toBe(false);
      expect(isInternalOrCanonicalHostname('127.evil.com')).toBe(false);
      expect(isInternalOrCanonicalHostname('127.custom-agency.com')).toBe(false);
    });

    it('identifies Cloudflare edge preview domains', () => {
      expect(isInternalOrCanonicalHostname('sophia-ai-factory.workers.dev')).toBe(true);
      expect(isInternalOrCanonicalHostname('preview.pages.dev')).toBe(true);
    });

    it('recognizes tenant custom domains as non-canonical', () => {
      expect(isInternalOrCanonicalHostname('portal.agencyalpha.com')).toBe(false);
      expect(isInternalOrCanonicalHostname('ai.videoclient.io')).toBe(false);
      expect(isInternalOrCanonicalHostname('studio.creatorhub.vn')).toBe(false);
    });
  });

  describe('extractHostname', () => {
    it('extracts from string input directly', () => {
      expect(extractHostname('PORTAL.CLIENT.COM:8080')).toBe('portal.client.com');
    });

    it('prioritizes x-forwarded-host header over host header', () => {
      const headers = new Headers({
        host: 'internal-edge.workers.dev',
        'x-forwarded-host': 'custom.agency.com, internal-edge.workers.dev',
      });
      expect(extractHostname(headers)).toBe('custom.agency.com');
    });

    it('falls back to host header when x-forwarded-host is missing', () => {
      const headers = new Headers({
        host: 'portal.myagency.com:443',
      });
      expect(extractHostname(headers)).toBe('portal.myagency.com');
    });

    it('extracts from Request object URL when headers are empty', () => {
      const req = new Request('https://portal.clientstudio.com/dashboard');
      expect(extractHostname(req)).toBe('portal.clientstudio.com');
    });
  });

  describe('resolveTenantFromHostname', () => {
    it('bypasses D1 queries for canonical domains and returns isInternal: true', async () => {
      const mockDb = {
        prepare: vi.fn(),
      } as unknown as D1Database;

      const result = await resolveTenantFromHostname(mockDb, 'sophia.agencyos.network');

      expect(result.isInternal).toBe(true);
      expect(result.isCustomDomain).toBe(false);
      expect(result.tenantOrgId).toBeNull();
      expect(result.whitelabelActive).toBe(false);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('queries D1 for custom domain and returns active tenant context', async () => {
      const mockFirst = vi.fn().mockResolvedValue({
        org_id: 'org_12345',
        hostname: 'portal.agencyalpha.com',
        active: 1,
        ssl_status: 'active',
      });
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare } as unknown as D1Database;

      const result = await resolveTenantFromHostname(mockDb, 'portal.agencyalpha.com');

      expect(mockPrepare).toHaveBeenCalledTimes(1);
      expect(mockBind).toHaveBeenCalledWith('portal.agencyalpha.com');
      expect(result.isInternal).toBe(false);
      expect(result.isCustomDomain).toBe(true);
      expect(result.tenantOrgId).toBe('org_12345');
      expect(result.customDomain).toBe('portal.agencyalpha.com');
      expect(result.whitelabelActive).toBe(true);
      expect(result.sslStatus).toBe('active');
    });

    it('caches positive resolution in isolate memory within TTL', async () => {
      const mockFirst = vi.fn().mockResolvedValue({
        org_id: 'org_99999',
        hostname: 'video.client.io',
        active: 1,
        ssl_status: 'active',
      });
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare } as unknown as D1Database;

      // Call twice
      const res1 = await resolveTenantFromHostname(mockDb, 'video.client.io');
      const res2 = await resolveTenantFromHostname(mockDb, 'video.client.io');

      expect(mockPrepare).toHaveBeenCalledTimes(1); // Cached!
      expect(res1).toEqual(res2);
      expect(res2.tenantOrgId).toBe('org_99999');
    });

    it('returns whitelabelActive: false if ssl_status is pending_validation', async () => {
      const mockFirst = vi.fn().mockResolvedValue({
        org_id: 'org_pending',
        hostname: 'pending.agency.com',
        active: 1,
        ssl_status: 'pending_validation',
      });
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare } as unknown as D1Database;

      const result = await resolveTenantFromHostname(mockDb, 'pending.agency.com');

      expect(result.whitelabelActive).toBe(false);
      expect(result.sslStatus).toBe('pending_validation');
      expect(result.tenantOrgId).toBe('org_pending');
    });

    it('handles negative cache for unregistered domain gracefully', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare } as unknown as D1Database;

      const result = await resolveTenantFromHostname(mockDb, 'unknown.domain.com');

      expect(result.isCustomDomain).toBe(true);
      expect(result.tenantOrgId).toBeNull();
      expect(result.whitelabelActive).toBe(false);

      // Second call hits negative cache
      await resolveTenantFromHostname(mockDb, 'unknown.domain.com');
      expect(mockPrepare).toHaveBeenCalledTimes(1);
    });

    it('falls back safely if db is null', async () => {
      const result = await resolveTenantFromHostname(null, 'custom.domain.com');

      expect(result.isCustomDomain).toBe(true);
      expect(result.tenantOrgId).toBeNull();
      expect(result.whitelabelActive).toBe(false);
    });
  });

  describe('injectTenantRoutingHeaders', () => {
    it('injects full white-label headers when active', () => {
      const headers = new Headers();
      const context: TenantHostnameContext = {
        isInternal: false,
        isCustomDomain: true,
        tenantOrgId: 'org_active_123',
        customDomain: 'portal.myagency.com',
        whitelabelActive: true,
        sslStatus: 'active',
      };

      injectTenantRoutingHeaders(headers, context);

      expect(getTenantOrgId(headers)).toBe('org_active_123');
      expect(getCustomDomain(headers)).toBe('portal.myagency.com');
      expect(isWhitelabelActive(headers)).toBe(true);
    });

    it('injects inactive status when domain is registered but not yet active', () => {
      const headers = new Headers();
      const context: TenantHostnameContext = {
        isInternal: false,
        isCustomDomain: true,
        tenantOrgId: 'org_pending_456',
        customDomain: 'pending.myagency.com',
        whitelabelActive: false,
        sslStatus: 'pending_validation',
      };

      injectTenantRoutingHeaders(headers, context);

      expect(getTenantOrgId(headers)).toBe('org_pending_456');
      expect(getCustomDomain(headers)).toBe('pending.myagency.com');
      expect(isWhitelabelActive(headers)).toBe(false);
    });

    it('sets x-whitelabel-active to false for canonical domains', () => {
      const headers = new Headers();
      const context: TenantHostnameContext = {
        isInternal: true,
        isCustomDomain: false,
        tenantOrgId: null,
        customDomain: null,
        whitelabelActive: false,
        sslStatus: null,
      };

      injectTenantRoutingHeaders(headers, context);

      expect(getTenantOrgId(headers)).toBeNull();
      expect(getCustomDomain(headers)).toBeNull();
      expect(isWhitelabelActive(headers)).toBe(false);
    });

    it('clears untrusted client headers before injecting verified values', () => {
      const headers = new Headers();
      headers.set('x-tenant-org-id', 'attacker_spoofed_org');
      headers.set('x-custom-domain', 'attacker-stolen-domain.com');
      headers.set('x-whitelabel-active', 'true');

      const context: TenantHostnameContext = {
        isInternal: true,
        isCustomDomain: false,
        tenantOrgId: null,
        customDomain: null,
        whitelabelActive: false,
        sslStatus: null,
      };

      injectTenantRoutingHeaders(headers, context);

      expect(getTenantOrgId(headers)).toBeNull();
      expect(getCustomDomain(headers)).toBeNull();
      expect(isWhitelabelActive(headers)).toBe(false);
    });

    it('URI-encodes unicode domains to avoid WHATWG ByteString errors', () => {
      const headers = new Headers();
      const context: TenantHostnameContext = {
        isInternal: false,
        isCustomDomain: true,
        tenantOrgId: 'org_vn_1',
        customDomain: 'tiếngviệt.com',
        whitelabelActive: true,
        sslStatus: 'active',
      };

      injectTenantRoutingHeaders(headers, context);

      expect(getCustomDomain(headers)).toBe(encodeURI('tiếngviệt.com'));
      expect(decodeURI(getCustomDomain(headers)!)).toBe('tiếngviệt.com');
    });
  });
});
