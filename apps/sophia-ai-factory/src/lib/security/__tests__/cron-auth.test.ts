import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { verifyCronAuth } from '@/lib/security/cron-auth';

function makeRequest(opts: {
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
} = {}): NextRequest {
  const url = new URL('https://sophia.agencyos.network/api/cron/test');
  if (opts.queryParams) {
    for (const [k, v] of Object.entries(opts.queryParams)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url, { headers: opts.headers });
}

describe('verifyCronAuth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Cloudflare internal trigger', () => {
    it('allows x-cf-cron: true header', () => {
      const req = makeRequest({ headers: { 'x-cf-cron': 'true' } });
      expect(verifyCronAuth(req)).toBeNull();
    });

    it('rejects x-cf-cron: false header', () => {
      const req = makeRequest({ headers: { 'x-cf-cron': 'false' } });
      expect(verifyCronAuth(req)).not.toBeNull();
    });
  });

  describe('Bearer token', () => {
    it('allows valid Bearer token', () => {
      vi.stubEnv('CRON_SECRET', 'test-secret-123');
      const req = makeRequest({ headers: { authorization: 'Bearer test-secret-123' } });
      expect(verifyCronAuth(req)).toBeNull();
    });

    it('rejects wrong Bearer token', () => {
      vi.stubEnv('CRON_SECRET', 'test-secret-123');
      const req = makeRequest({ headers: { authorization: 'Bearer wrong-token' } });
      expect(verifyCronAuth(req)).not.toBeNull();
    });

    it('rejects when CRON_SECRET is unset (401, not fail-open)', () => {
      vi.stubEnv('CRON_SECRET', '');
      const req = makeRequest({ headers: { authorization: 'Bearer anything' } });
      const result = verifyCronAuth(req);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });
  });

  describe('x-cron-secret header', () => {
    it('allows x-cron-secret: true (legacy CF trigger)', () => {
      const req = makeRequest({ headers: { 'x-cron-secret': 'true' } });
      expect(verifyCronAuth(req)).toBeNull();
    });

    it('allows x-cron-secret matching CRON_SECRET', () => {
      vi.stubEnv('CRON_SECRET', 'my-secret');
      const req = makeRequest({ headers: { 'x-cron-secret': 'my-secret' } });
      expect(verifyCronAuth(req)).toBeNull();
    });

    it('rejects x-cron-secret with wrong value', () => {
      vi.stubEnv('CRON_SECRET', 'my-secret');
      const req = makeRequest({ headers: { 'x-cron-secret': 'wrong' } });
      expect(verifyCronAuth(req)).not.toBeNull();
    });
  });

  describe('token query param', () => {
    it('allows valid ?token= query param', () => {
      vi.stubEnv('CRON_SECRET', 'uptime-secret');
      const req = makeRequest({ queryParams: { token: 'uptime-secret' } });
      expect(verifyCronAuth(req)).toBeNull();
    });

    it('rejects wrong ?token= query param', () => {
      vi.stubEnv('CRON_SECRET', 'uptime-secret');
      const req = makeRequest({ queryParams: { token: 'wrong' } });
      expect(verifyCronAuth(req)).not.toBeNull();
    });
  });

  describe('dev mode bypass', () => {
    it('allows in development without any auth', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const req = makeRequest();
      expect(verifyCronAuth(req)).toBeNull();
    });

    it('rejects in production without auth', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CRON_SECRET', '');
      const req = makeRequest();
      const result = verifyCronAuth(req);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });
  });

  describe('edge cases', () => {
    it('handles missing nextUrl gracefully (test requests)', () => {
      vi.stubEnv('CRON_SECRET', 'test');
      // Simulate a minimal request without searchParams
      const req = new Request('https://example.com/api/cron/test') as unknown as NextRequest;
      const result = verifyCronAuth(req);
      expect(result).not.toBeNull();
    });

    it('rejects when no headers match', () => {
      vi.stubEnv('CRON_SECRET', 'secret');
      const req = makeRequest();
      const result = verifyCronAuth(req);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });
  });
});
