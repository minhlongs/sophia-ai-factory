/**
 * Tests for D1 API key store — roundtrip, revoke, tier rate limits.
 * @module __tests__/handover/api-key-d1-store.test
 */

import { describe, it, expect } from 'vitest';
import { tierToRateLimit, KEY_PREFIX } from '@/lib/api-keys/d1-store';

describe('tierToRateLimit', () => {
  it('BASIC = 100', () => expect(tierToRateLimit('BASIC')).toBe(100));
  it('PREMIUM = 500', () => expect(tierToRateLimit('PREMIUM')).toBe(500));
  it('ENTERPRISE = 2000', () => expect(tierToRateLimit('ENTERPRISE')).toBe(2000));
  it('MASTER = 2000', () => expect(tierToRateLimit('MASTER')).toBe(2000));
});

describe('KEY_PREFIX', () => {
  it('starts with sk_live_', () => {
    expect(KEY_PREFIX).toBe('sk_live_');
  });
});

// Note: createApiKey/listApiKeys/revokeApiKey require a D1 instance.
// Full roundtrip tests run against real D1 in E2E suite.
// Here we test logic-only parts.
describe('key format', () => {
  it('KEY_PREFIX is non-empty', () => {
    expect(KEY_PREFIX.length).toBeGreaterThan(0);
  });
});
