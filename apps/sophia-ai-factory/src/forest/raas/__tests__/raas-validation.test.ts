/**
 * Unit tests for raas-validation
 * @module forest/raas/__tests__/raas-validation.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  extractLicenseKey,
  shouldApplyRaasGate,
  getRaaSConfig,
  createForbiddenResponse,
} from '../raas-validation';

describe('extractLicenseKey', () => {
  function makeRequest(headers: Record<string, string>, searchParams?: string): NextRequest {
    const url = searchParams ? `http://test.com/api/test?${searchParams}` : 'http://test.com/api/test';
    return new NextRequest(url, { headers });
  }

  it('extracts from X-RaaS-License-Key header first', () => {
    const req = makeRequest({ 'x-raas-license-key': 'raas_premium_abc123' });
    expect(extractLicenseKey(req)).toBe('raas_premium_abc123');
  });

  it('extracts from Authorization Bearer header second', () => {
    const req = makeRequest({ authorization: 'Bearer raas_basic_xyz789' });
    expect(extractLicenseKey(req)).toBe('raas_basic_xyz789');
  });

  it('ignores Authorization header when token does not start with raas_', () => {
    const req = makeRequest({ authorization: 'Bearer jwt_token_here' });
    expect(extractLicenseKey(req)).toBeNull();
  });

  it('extracts from query param as last resort', () => {
    const req = makeRequest({}, 'license_key=raas_enterprise_def456');
    expect(extractLicenseKey(req)).toBe('raas_enterprise_def456');
  });

  it('returns null when no key is found', () => {
    const req = makeRequest({});
    expect(extractLicenseKey(req)).toBeNull();
  });

  it('prioritizes X-RaaS-License-Key over Authorization', () => {
    const req = makeRequest({
      'x-raas-license-key': 'raas_premium_first',
      authorization: 'Bearer raas_basic_second',
    });
    expect(extractLicenseKey(req)).toBe('raas_premium_first');
  });

  it('prioritizes Authorization over query param', () => {
    const req = makeRequest(
      { authorization: 'Bearer raas_premium_auth' },
      'license_key=raas_basic_query',
    );
    expect(extractLicenseKey(req)).toBe('raas_premium_auth');
  });
});

describe('shouldApplyRaasGate', () => {
  const publicRoutes = [
    '/api/health',
    '/api/setup/wizard',
    '/api/webhooks/nowpayments',
    '/api/webhooks/telegram',
    '/api/auth/login',
    '/api/discovery',
    '/api/sophia-index',
  ];

  publicRoutes.forEach(route => {
    it(`excludes ${route} from RaaS gate`, () => {
      expect(shouldApplyRaasGate(route)).toBe(false);
    });
  });

  const protectedRoutes = [
    '/api/generate',
    '/api/license/validate',
    '/api/usage',
    '/api/analytics',
  ];

  protectedRoutes.forEach(route => {
    it(`applies RaaS gate to ${route}`, () => {
      expect(shouldApplyRaasGate(route)).toBe(true);
    });
  });
});

describe('createForbiddenResponse', () => {
  it('returns 403 response with missing-key message', async () => {
    const response = createForbiddenResponse('missing-key');
    expect(response.status).toBe(403);
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.code).toBe('RAAS_FORBIDDEN');
    expect(body.message).toContain('X-RaaS-License-Key');
  });

  it('returns 403 response with invalid-format message', async () => {
    const response = createForbiddenResponse('invalid-format');
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.message).toContain('raas_{tier}_{payload}');
  });

  it('returns 403 response with expired message', async () => {
    const response = createForbiddenResponse('expired');
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.message).toContain('expired');
  });

  it('returns 403 response with unknown reason message', async () => {
    const response = createForbiddenResponse('unknown_reason');
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.message).toBe('Access denied');
  });

  it('includes X-RaaS-Reason header', () => {
    const response = createForbiddenResponse('missing-key');
    expect(response.headers.get('X-RaaS-Reason')).toBe('missing-key');
  });
});

describe('getRaaSConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects development mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('RAAS_BYPASS_DEV', 'true');
    const config = getRaaSConfig();
    expect(config.isDev).toBe(true);
    expect(config.bypassDev).toBe(true);
  });

  it('detects production mode', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const config = getRaaSConfig();
    expect(config.isDev).toBe(false);
  });

  it('detects when secret is present', () => {
    vi.stubEnv('RAAS_LICENSE_SECRET', 'some-secret');
    const config = getRaaSConfig();
    expect(config.hasSecret).toBe(true);
  });

  it('detects V1 format flag', () => {
    vi.stubEnv('RAAS_V1_FORMAT', 'true');
    const config = getRaaSConfig();
    expect(config.v1Format).toBe(true);
  });

  it('detects when license key is present', () => {
    vi.stubEnv('RAAS_LICENSE_KEY', 'key-here');
    const config = getRaaSConfig();
    expect(config.enabled).toBe(true);
  });
});
