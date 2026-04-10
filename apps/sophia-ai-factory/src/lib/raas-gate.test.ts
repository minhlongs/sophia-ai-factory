/**
 * RaaS Gate Tests
 *
 * Tests for HMAC-based license key validation middleware
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { raasGate, shouldApplyRaasGate, getRaaSConfig } from './raas-gate';

// Mock logger
vi.mock('./utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock audit logger to prevent Supabase calls during tests
vi.mock('./audit/audit-logger', () => ({
  logValidationWithReceipt: vi.fn().mockResolvedValue(null),
  serializeReceiptForHeader: vi.fn().mockReturnValue(''),
}));

describe('RaaS Gate', () => {
  describe('shouldApplyRaasGate', () => {
    it('should apply to protected API routes', () => {
      expect(shouldApplyRaasGate('/api/campaigns')).toBe(true);
      expect(shouldApplyRaasGate('/api/user/settings')).toBe(true);
      expect(shouldApplyRaasGate('/api/admin/stats')).toBe(true);
    });

    it('should skip public routes', () => {
      expect(shouldApplyRaasGate('/api/health')).toBe(false);
      expect(shouldApplyRaasGate('/api/setup/save')).toBe(false);
      expect(shouldApplyRaasGate('/api/webhooks/nowpayments')).toBe(false);
      expect(shouldApplyRaasGate('/api/webhooks/telegram')).toBe(false);
      expect(shouldApplyRaasGate('/api/auth')).toBe(false);
      expect(shouldApplyRaasGate('/api/discovery/search')).toBe(false);
    });
  });

  describe('getRaaSConfig', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should return config with all fields', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RAAS_BYPASS_DEV', 'true');
      vi.stubEnv('RAAS_LICENSE_KEY', 'raas_premium_test');
      vi.stubEnv('RAAS_LICENSE_SECRET', 'test-secret');
      vi.stubEnv('RAAS_V1_FORMAT', 'false');

      const config = getRaaSConfig();
      expect(config.enabled).toBe(true);
      expect(config.bypassDev).toBe(true);
      expect(config.isDev).toBe(true);
      expect(config.hasSecret).toBe(true);
      expect(config.v1Format).toBe(false);
    });

    it('should return config in production with all fields', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RAAS_BYPASS_DEV', 'false');
      vi.stubEnv('RAAS_LICENSE_KEY', 'raas_premium_test');
      vi.stubEnv('RAAS_LICENSE_SECRET', 'test-secret');
      vi.stubEnv('RAAS_V1_FORMAT', 'true');

      const config = getRaaSConfig();
      expect(config.enabled).toBe(true);
      expect(config.bypassDev).toBe(false);
      expect(config.isDev).toBe(false);
      expect(config.hasSecret).toBe(true);
      expect(config.v1Format).toBe(true);
    });

    it('should return missing secret in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RAAS_BYPASS_DEV', 'false');
      vi.stubEnv('RAAS_LICENSE_KEY', 'raas_premium_test');
      vi.stubEnv('RAAS_LICENSE_SECRET', '');

      const config = getRaaSConfig();
      expect(config.enabled).toBe(true);
      expect(config.bypassDev).toBe(false);
      expect(config.isDev).toBe(false);
      expect(config.hasSecret).toBe(false);
    });
  });

  describe('raasGate middleware', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should allow valid requests with dev bypass', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RAAS_BYPASS_DEV', 'true');

      const request = new NextRequest(new URL('http://localhost:3000/api/campaigns'));
      const result = await raasGate(request);

      expect(result.valid).toBe(true);
    });

    it('should block requests without license key in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RAAS_BYPASS_DEV', 'false');
      vi.stubEnv('RAAS_LICENSE_SECRET', 'test-secret');

      const request = new NextRequest(new URL('http://localhost:3000/api/campaigns'));
      const result = await raasGate(request);

      expect(result.valid).toBe(false);
      expect(result.response?.status).toBe(403);
      expect(result.response?.headers.get('X-RaaS-Reason')).toBe('missing-key');
    });

    it('should block requests with invalid key format in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RAAS_BYPASS_DEV', 'false');
      vi.stubEnv('RAAS_LICENSE_SECRET', 'test-secret');

      const request = new NextRequest(new URL('http://localhost:3000/api/campaigns'), {
        headers: {
          'x-raas-license-key': 'invalid_key_format',
        },
      });

      const result = await raasGate(request);
      expect(result.valid).toBe(false);
      expect(result.response?.status).toBe(403);
    });

    it('should allow V1 format keys when RAAS_V1_FORMAT=true', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RAAS_BYPASS_DEV', 'false');
      vi.stubEnv('RAAS_V1_FORMAT', 'true');

      // V1 format: raas_{tier}_{payload} (3 parts)
      const request = new NextRequest(new URL('http://localhost:3000/api/campaigns'), {
        headers: {
          'x-raas-license-key': 'raas_premium_abc123xyz',
        },
      });

      const result = await raasGate(request);
      expect(result.valid).toBe(true);
      expect(result.tier).toBe('premium');
    });

    it('should extract tier from Bearer token', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RAAS_BYPASS_DEV', 'true');

      const request = new NextRequest(new URL('http://localhost:3000/api/campaigns'), {
        headers: {
          'authorization': 'Bearer raas_enterprise_token123',
        },
      });

      const result = await raasGate(request);
      expect(result.valid).toBe(true);
    });

    it('should extract license key from query param (for webhook testing)', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RAAS_BYPASS_DEV', 'true');

      const request = new NextRequest(new URL('http://localhost:3000/api/webhook?license_key=raas_basic_test123'));

      const result = await raasGate(request);
      expect(result.valid).toBe(true);
    });
  });
});
