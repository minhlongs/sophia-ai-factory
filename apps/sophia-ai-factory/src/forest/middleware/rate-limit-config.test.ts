/**
 * Rate Limit Config Tests
 * Tests for endpoint pattern matching and configuration
 */

import { describe, it, expect } from 'vitest';
import {
  RATE_LIMITS,
  ENDPOINT_RULES,
  getRateLimitConfig,
  shouldSkipRateLimit,
  type EndpointRateLimit
} from './rate-limit-config';

describe('RATE_LIMITS', () => {
  it('should have all expected limit configurations', () => {
    expect(RATE_LIMITS).toHaveProperty('api');
    expect(RATE_LIMITS).toHaveProperty('apiV1');
    expect(RATE_LIMITS).toHaveProperty('ingestion');
    expect(RATE_LIMITS).toHaveProperty('admin');
    expect(RATE_LIMITS).toHaveProperty('auth');
    expect(RATE_LIMITS).toHaveProperty('webhooks');
    expect(RATE_LIMITS).toHaveProperty('health');
    expect(RATE_LIMITS).toHaveProperty('usage');
    expect(RATE_LIMITS).toHaveProperty('analytics');
    expect(RATE_LIMITS).toHaveProperty('heygen');
    expect(RATE_LIMITS).toHaveProperty('setup');
    expect(RATE_LIMITS).toHaveProperty('checkout');
    expect(RATE_LIMITS).toHaveProperty('discovery');
    expect(RATE_LIMITS).toHaveProperty('default');
  });

  it('should have valid config structure', () => {
    Object.entries(RATE_LIMITS).forEach(([name, config]) => {
      expect(config).toHaveProperty('intervalMs');
      expect(config).toHaveProperty('maxRequests');
      expect(typeof config.intervalMs).toBe('number');
      expect(typeof config.maxRequests).toBe('number');
      expect(config.intervalMs).toBeGreaterThan(0);
      expect(config.maxRequests).toBeGreaterThan(0);
    });
  });

  it('should have stricter limits for auth endpoints', () => {
    const authLimit = RATE_LIMITS.auth;
    const generalLimit = RATE_LIMITS.api;

    // Auth should allow fewer requests
    expect(authLimit.maxRequests).toBeLessThan(generalLimit.maxRequests);
    // Auth should have longer interval
    expect(authLimit.intervalMs).toBeGreaterThan(generalLimit.intervalMs);
  });

  it('should have permissive limits for health checks', () => {
    const healthLimit = RATE_LIMITS.health;
    const generalLimit = RATE_LIMITS.api;

    // Health should allow more requests
    expect(healthLimit.maxRequests).toBeGreaterThan(generalLimit.maxRequests);
  });
});

describe('ENDPOINT_RULES', () => {
  it('should have rules in correct order', () => {
    // Auth rules should come before general API rules
    const authIndex = ENDPOINT_RULES.findIndex(r => r.pattern.startsWith('/api/auth'));
    const apiIndex = ENDPOINT_RULES.findIndex(r => r.pattern === '/api/*');

    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(apiIndex).toBeGreaterThanOrEqual(0);
    expect(authIndex).toBeLessThan(apiIndex);
  });

  it('should have all required endpoint patterns', () => {
    const patterns = ENDPOINT_RULES.map(r => r.pattern);

    expect(patterns).toContain('/api/auth/*');
    expect(patterns).toContain('/api/v1/*');
    expect(patterns).toContain('/api/ingestion/*');
    expect(patterns).toContain('/api/admin/*');
    expect(patterns).toContain('/api/webhooks/*');
    expect(patterns).toContain('/api/health');
    expect(patterns).toContain('/api/usage/*');
    expect(patterns).toContain('/api/analytics/*');
    expect(patterns).toContain('/api/heygen/*');
    expect(patterns).toContain('/api/setup/*');
    expect(patterns).toContain('/api/checkout');
    expect(patterns).toContain('/api/discovery/*');
  });

  it('should have valid config for each rule', () => {
    ENDPOINT_RULES.forEach(rule => {
      expect(rule).toHaveProperty('pattern');
      expect(rule).toHaveProperty('config');
      expect(rule).toHaveProperty('description');
      expect(rule.config).toHaveProperty('intervalMs');
      expect(rule.config).toHaveProperty('maxRequests');
    });
  });
});

describe('getRateLimitConfig', () => {
  it('should match auth endpoints', () => {
    const config = getRateLimitConfig('/api/auth/login');
    expect(config).toEqual(RATE_LIMITS.auth);
  });

  it('should match v1 API endpoints', () => {
    const config = getRateLimitConfig('/api/v1/usage');
    expect(config).toEqual(RATE_LIMITS.apiV1);
  });

  it('should match nested v1 API endpoints', () => {
    // Nested paths fall back to general API limit since we use single * pattern
    const config = getRateLimitConfig('/api/v1/usage/batch');
    expect(config).toEqual(RATE_LIMITS.api);
  });

  it('should match ingestion endpoints', () => {
    const config = getRateLimitConfig('/api/ingestion/trigger');
    expect(config).toEqual(RATE_LIMITS.ingestion);
  });

  it('should match admin endpoints', () => {
    const config = getRateLimitConfig('/api/admin/invite');
    expect(config).toEqual(RATE_LIMITS.admin);
  });

  it('should match nested admin endpoints', () => {
    // Nested paths fall back to general API limit since we use single * pattern
    const config = getRateLimitConfig('/api/admin/licenses/audit');
    expect(config).toEqual(RATE_LIMITS.api);
  });

  it('should match webhook endpoints', () => {
    const config = getRateLimitConfig('/api/webhooks/nowpayments');
    expect(config).toEqual(RATE_LIMITS.webhooks);
  });

  it('should match health endpoints', () => {
    const config = getRateLimitConfig('/api/health');
    expect(config).toEqual(RATE_LIMITS.health);
  });

  it('should match usage endpoints', () => {
    const config = getRateLimitConfig('/api/usage/summary');
    expect(config).toEqual(RATE_LIMITS.usage);
  });

  it('should match analytics endpoints', () => {
    const config = getRateLimitConfig('/api/analytics/usage');
    expect(config).toEqual(RATE_LIMITS.analytics);
  });

  it('should match heygen endpoints', () => {
    const config = getRateLimitConfig('/api/heygen/avatars');
    expect(config).toEqual(RATE_LIMITS.heygen);
  });

  it('should match setup endpoints', () => {
    const config = getRateLimitConfig('/api/setup/save');
    expect(config).toEqual(RATE_LIMITS.setup);
  });

  it('should match checkout endpoints', () => {
    const config = getRateLimitConfig('/api/checkout');
    expect(config).toEqual(RATE_LIMITS.checkout);
  });

  it('should match discovery endpoints', () => {
    const config = getRateLimitConfig('/api/discovery/search');
    expect(config).toEqual(RATE_LIMITS.discovery);
  });

  it('should fall back to default for unknown paths', () => {
    const config = getRateLimitConfig('/api/unknown/random');
    expect(config).toEqual(RATE_LIMITS.default);
  });

  it('should fall back to default for non-API paths', () => {
    const config = getRateLimitConfig('/dashboard/settings');
    expect(config).toEqual(RATE_LIMITS.default);
  });
});

describe('shouldSkipRateLimit', () => {
  it('should skip static asset files', () => {
    expect(shouldSkipRateLimit('/api/test.ico')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.png')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.jpg')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.jpeg')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.gif')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.svg')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.css')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.js')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.woff')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.woff2')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.ttf')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.eot')).toBe(true);
  });

  it('should skip Next.js internal routes', () => {
    expect(shouldSkipRateLimit('/_next/static/chunks/main.js')).toBe(true);
    expect(shouldSkipRateLimit('/_next/webpack-hmr')).toBe(true);
    expect(shouldSkipRateLimit('/__nextjs-original-stack-trace')).toBe(true);
  });

  it('should not skip regular API endpoints', () => {
    expect(shouldSkipRateLimit('/api/v1/usage')).toBe(false);
    expect(shouldSkipRateLimit('/api/admin/invite')).toBe(false);
    expect(shouldSkipRateLimit('/api/checkout')).toBe(false);
  });

  it('should handle case-insensitive extensions', () => {
    expect(shouldSkipRateLimit('/api/test.PNG')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.CSS')).toBe(true);
    expect(shouldSkipRateLimit('/api/test.JS')).toBe(true);
  });
});

describe('Pattern matching', () => {
  it('should match single-level wildcards', () => {
    // This tests the internal matching logic indirectly
    const config = getRateLimitConfig('/api/health');
    expect(config).toEqual(RATE_LIMITS.health);
  });

  it('should match multi-level paths with general API limit', () => {
    // Deep nested paths fall back to general API limit
    const config = getRateLimitConfig('/api/admin/licenses/123/regenerate');
    expect(config).toEqual(RATE_LIMITS.api);
  });
});
