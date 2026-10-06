/**
 * Integration Test Suite: AGY Tenant Isolation Edge Middleware
 *
 * Tests cryptographic tenant token verification, cross-tenant barrier enforcement,
 * sliding-window rate-limiting (HTTP 429), permission checking, and header decoration.
 *
 * Layer: forest/middleware/__tests__
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  validateAgyTenantIsolation,
  agyTenantIsolationMiddleware,
  clearAgencyRateLimits,
} from '../agy-tenant-isolation';
import { generateTenantToken } from '@/tree/agy/tenant-token-engine';

const TEST_SECRET = 'ultra-secure-test-secret-key-for-agy-tokens-32bytes';

describe('AGY Tenant Isolation Edge Middleware', () => {
  beforeEach(() => {
    clearAgencyRateLimits();
  });

  describe('validateAgyTenantIsolation', () => {
    it('allows valid request with verified tenant token matching target agency', async () => {
      const { token } = await generateTenantToken(
        {
          agencyId: 'agy_acme_corp',
          name: 'Integration Token',
          permissions: ['read', 'write'],
        },
        TEST_SECRET
      );

      const request = new NextRequest('https://api.agencyos.network/api/v1/campaigns', {
        headers: {
          'x-tenant-token': token,
          'x-agency-id': 'agy_acme_corp',
        },
      });

      const result = await validateAgyTenantIsolation(request, {
        secret: TEST_SECRET,
      });

      expect(result.allowed).toBe(true);
      expect(result.status).toBe(200);
      expect(result.context?.agencyId).toBe('agy_acme_corp');
    });

    it('extracts token case-insensitively from bearer authorization header (RFC 7235)', async () => {
      const { token } = await generateTenantToken(
        { agencyId: 'agy_case_test', permissions: ['read'] },
        TEST_SECRET
      );

      // Lowercase 'bearer '
      const reqLower = new NextRequest('https://api.agencyos.network/api/v1/ping', {
        headers: { authorization: `bearer ${token}` },
      });
      const resLower = await validateAgyTenantIsolation(reqLower, { secret: TEST_SECRET });
      expect(resLower.allowed).toBe(true);
      expect(resLower.context?.agencyId).toBe('agy_case_test');

      // Uppercase 'BEARER   ' with variable whitespace
      const reqUpper = new NextRequest('https://api.agencyos.network/api/v1/ping', {
        headers: { authorization: `BEARER   ${token}` },
      });
      const resUpper = await validateAgyTenantIsolation(reqUpper, { secret: TEST_SECRET });
      expect(resUpper.allowed).toBe(true);
      expect(resUpper.context?.agencyId).toBe('agy_case_test');
    });

    it('blocks request when token signature is invalid', async () => {
      const request = new NextRequest('https://api.agencyos.network/api/v1/campaigns', {
        headers: {
          'x-tenant-token': 'agy_tok_invalidpayload.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        },
      });

      const result = await validateAgyTenantIsolation(request, {
        secret: TEST_SECRET,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect(result.errorCode).toBe('INVALID_TENANT_TOKEN');
    });

    it('blocks request with expired tenant token with HTTP 401', async () => {
      const nowMs = 1700000000000;
      const { token } = await generateTenantToken(
        {
          agencyId: 'agy_expired_corp',
          expiresInSeconds: 10,
        },
        TEST_SECRET
      );

      const request = new NextRequest('https://api.agencyos.network/api/v1/campaigns', {
        headers: {
          'x-tenant-token': token,
        },
      });

      // Advance clock by 100 seconds
      const result = await validateAgyTenantIsolation(request, {
        secret: TEST_SECRET,
        nowMs: Date.now() + 100000,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(401);
      expect(result.errorCode).toBe('TENANT_TOKEN_EXPIRED');
    });

    it('enforces cross-tenant protection: blocks token for Agency A trying to access Agency B', async () => {
      const { token } = await generateTenantToken(
        {
          agencyId: 'agy_tenant_alpha',
          permissions: ['*'],
        },
        TEST_SECRET
      );

      const request = new NextRequest('https://api.agencyos.network/api/v1/data', {
        headers: {
          'x-tenant-token': token,
          'x-agency-id': 'agy_tenant_beta', // Attacking or misdirected tenant target
        },
      });

      const result = await validateAgyTenantIsolation(request, {
        secret: TEST_SECRET,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect(result.errorCode).toBe('CROSS_TENANT_ACCESS_DENIED');
      expect(result.reason).toContain('Cross-tenant access denied');
    });

    it('enforces cross-tenant query parameter mismatch protection', async () => {
      const { token } = await generateTenantToken(
        { agencyId: 'agy_legit' },
        TEST_SECRET
      );

      const request = new NextRequest('https://api.agencyos.network/api/v1/data?agency_id=agy_foreign_target', {
        headers: {
          'x-tenant-token': token,
        },
      });

      const result = await validateAgyTenantIsolation(request, {
        secret: TEST_SECRET,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect(result.errorCode).toBe('CROSS_TENANT_ACCESS_DENIED');
    });

    it('enforces required token when requireToken is set', async () => {
      const request = new NextRequest('https://api.agencyos.network/api/v1/admin/secure', {
        headers: {},
      });

      const result = await validateAgyTenantIsolation(request, {
        requireToken: true,
        secret: TEST_SECRET,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(401);
      expect(result.errorCode).toBe('MISSING_TENANT_TOKEN');
    });

    it('validates required token permissions', async () => {
      const { token: readToken } = await generateTenantToken(
        { agencyId: 'agy_perms', permissions: ['read'] },
        TEST_SECRET
      );

      const request = new NextRequest('https://api.agencyos.network/api/v1/create', {
        headers: {
          authorization: `Bearer ${readToken}`,
        },
      });

      const result = await validateAgyTenantIsolation(request, {
        requiredPermission: 'write',
        secret: TEST_SECRET,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect(result.errorCode).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('enforces per-agency sliding-window rate limit with HTTP 429', async () => {
      const agencyId = 'agy_rate_limited';
      const rpsLimit = 3;

      for (let i = 0; i < rpsLimit; i++) {
        const req = new NextRequest('https://api.agencyos.network/api/v1/ping', {
          headers: { 'x-agency-id': agencyId },
        });
        const res = await validateAgyTenantIsolation(req, {
          defaultRpsLimit: rpsLimit,
          secret: TEST_SECRET,
        });
        expect(res.allowed).toBe(true);
      }

      // 4th request in the same 1-second window exceeds rate limit
      const excessReq = new NextRequest('https://api.agencyos.network/api/v1/ping', {
        headers: { 'x-agency-id': agencyId },
      });
      const excessRes = await validateAgyTenantIsolation(excessReq, {
        defaultRpsLimit: rpsLimit,
        secret: TEST_SECRET,
      });

      expect(excessRes.allowed).toBe(false);
      expect(excessRes.status).toBe(429);
      expect(excessRes.errorCode).toBe('AGENCY_RATE_LIMIT_EXCEEDED');
      expect(excessRes.rateLimit?.remaining).toBe(0);
      expect(excessRes.rateLimit?.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('agyTenantIsolationMiddleware', () => {
    it('returns null and decorates request headers when access is permitted', async () => {
      const { token } = await generateTenantToken(
        { agencyId: 'agy_middleware_test' },
        TEST_SECRET
      );

      const request = new NextRequest('https://beta.agencyos.network/api/v1/test', {
        headers: {
          'x-tenant-token': token,
          'x-agency-slug': 'beta',
        },
      });

      const response = await agyTenantIsolationMiddleware(request, {
        secret: TEST_SECRET,
      });

      expect(response).toBeNull();
      expect(request.headers.get('x-agency-id')).toBe('agy_middleware_test');
      expect(request.headers.get('x-agency-slug')).toBe('beta');
      expect(request.headers.get('x-tenant-isolation-status')).toBe('verified');
    });

    it('returns 403 JSON response when cross-tenant attack is blocked', async () => {
      const { token } = await generateTenantToken(
        { agencyId: 'agy_victim' },
        TEST_SECRET
      );

      const request = new NextRequest('https://api.agencyos.network/api/v1/secure', {
        headers: {
          'x-tenant-token': token,
          'x-agency-id': 'agy_attacker_override',
        },
      });

      const response = await agyTenantIsolationMiddleware(request, {
        secret: TEST_SECRET,
      });

      expect(response).not.toBeNull();
      expect(response?.status).toBe(403);

      const json = (await response?.json()) as { code?: string };
      expect(json.code).toBe('CROSS_TENANT_ACCESS_DENIED');
      expect(response?.headers.get('X-Tenant-Isolation-Status')).toBe('denied');
      expect(response?.headers.get('X-Tenant-Isolation-Reason')).toBe('CROSS_TENANT_ACCESS_DENIED');
    });

    it('returns 429 JSON response with rate-limit headers when rate limit exceeded', async () => {
      const agencyId = 'agy_mw_rate';
      const rpsLimit = 2;

      for (let i = 0; i < rpsLimit; i++) {
        const req = new NextRequest('https://api.agencyos.network/api/v1/ping', {
          headers: { 'x-agency-id': agencyId },
        });
        await agyTenantIsolationMiddleware(req, { defaultRpsLimit: rpsLimit, secret: TEST_SECRET });
      }

      const blockedReq = new NextRequest('https://api.agencyos.network/api/v1/ping', {
        headers: { 'x-agency-id': agencyId },
      });
      const blockedRes = await agyTenantIsolationMiddleware(blockedReq, {
        defaultRpsLimit: rpsLimit,
        secret: TEST_SECRET,
      });

      expect(blockedRes).not.toBeNull();
      expect(blockedRes?.status).toBe(429);
      expect(blockedRes?.headers.get('X-Agency-RateLimit-Remaining')).toBe('0');
      expect(blockedRes?.headers.get('X-Tenant-Isolation-Reason')).toBe('AGENCY_RATE_LIMIT_EXCEEDED');
    });
  });
});
