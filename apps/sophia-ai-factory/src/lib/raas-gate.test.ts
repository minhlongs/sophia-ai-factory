/**
 * RaaS Gate Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { raasGate, shouldApplyRaasGate, validateLicenseKey, getRaaSConfig } from './raas-gate';

// Mock logger
vi.mock('./utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RaaS Gate', () => {
  describe('validateLicenseKey', () => {
    it('should return valid for dev bypass', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RAAS_BYPASS_DEV', 'true');

      const result = validateLicenseKey(null);
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('dev-bypass');
    });

    it('should reject missing key in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RAAS_BYPASS_DEV', 'false');

      const result = validateLicenseKey(null);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing-key');
    });

    it('should reject invalid format', () => {
      vi.stubEnv('NODE_ENV', 'production');

      const result = validateLicenseKey('invalid_key');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid-format');
    });

    it('should accept valid key format', () => {
      vi.stubEnv('NODE_ENV', 'production');

      const result = validateLicenseKey('raas_premium_abc123xyz');
      expect(result.valid).toBe(true);
      expect(result.tier).toBe('premium');
    });

    it('should extract tier from key', () => {
      vi.stubEnv('NODE_ENV', 'production');

      const tiers = ['basic', 'premium', 'enterprise', 'master'];
      tiers.forEach(tier => {
        const result = validateLicenseKey(`raas_${tier}_test123`);
        expect(result.valid).toBe(true);
        expect(result.tier).toBe(tier);
      });
    });
  });

  describe('shouldApplyRaasGate', () => {
    it('should apply to protected API routes', () => {
      expect(shouldApplyRaasGate('/api/campaigns')).toBe(true);
      expect(shouldApplyRaasGate('/api/user/settings')).toBe(true);
      expect(shouldApplyRaasGate('/api/admin/stats')).toBe(true);
    });

    it('should skip public routes', () => {
      expect(shouldApplyRaasGate('/api/health')).toBe(false);
      expect(shouldApplyRaasGate('/api/setup/save')).toBe(false);
      expect(shouldApplyRaasGate('/api/webhooks/polar')).toBe(false);
      expect(shouldApplyRaasGate('/api/webhooks/telegram')).toBe(false);
      expect(shouldApplyRaasGate('/api/auth')).toBe(false);
      expect(shouldApplyRaasGate('/api/discovery/search')).toBe(false);
    });
  });

  describe('getRaaSConfig', () => {
    it('should return config with bypass enabled', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RAAS_BYPASS_DEV', 'true');
      vi.stubEnv('RAAS_LICENSE_KEY', 'raas_premium_test');

      const config = getRaaSConfig();
      expect(config.enabled).toBe(true);
      expect(config.bypassDev).toBe(true);
      expect(config.isDev).toBe(true);
    });

    it('should return config in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RAAS_BYPASS_DEV', 'false');
      vi.stubEnv('RAAS_LICENSE_KEY', 'raas_premium_test');

      const config = getRaaSConfig();
      expect(config.enabled).toBe(true);
      expect(config.bypassDev).toBe(false);
      expect(config.isDev).toBe(false);
    });
  });

  describe('raasGate middleware', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should allow valid requests with license key', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RAAS_BYPASS_DEV', 'true');

      const request = new NextRequest(new URL('http://localhost:3000/api/campaigns'), {
        headers: {
          'x-raas-license-key': 'raas_premium_abc123',
        },
      });

      const result = await raasGate(request);
      expect(result.valid).toBe(true);
    });

    it('should block requests without license key in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RAAS_BYPASS_DEV', 'false');

      const request = new NextRequest(new URL('http://localhost:3000/api/campaigns'));

      const result = await raasGate(request);
      expect(result.valid).toBe(false);
      expect(result.response?.status).toBe(403);
    });
  });
});
