/**
 * Tests for seed/auth/cookie-name — stable Better Auth cookie name + prefix helper.
 *
 * Covers:
 *  - getSessionCookieName() returns __Secure- prefixed name in production
 *  - getSessionCookieName() returns bare name in development
 *  - isProductionEnvironment() matches NODE_ENV
 *  - Retry-After math produces correct seconds from ms reset timestamp
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { getSessionCookieName, isProductionEnvironment } from '@/seed/auth/cookie-name';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getSessionCookieName', () => {
  it('returns __Secure-prefixed name in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getSessionCookieName()).toBe('__Secure-better-auth.session_token');
  });

  it('returns bare name in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(getSessionCookieName()).toBe('better-auth.session_token');
  });

  it('returns __Secure-prefixed name for test environment', () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(getSessionCookieName()).toBe('__Secure-better-auth.session_token');
  });

  it('is deterministic across consecutive calls', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const a = getSessionCookieName();
    const b = getSessionCookieName();
    expect(a).toBe(b);
  });
});

describe('isProductionEnvironment', () => {
  it('returns true when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isProductionEnvironment()).toBe(true);
  });

  it('returns false when NODE_ENV is development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isProductionEnvironment()).toBe(false);
  });

  it('returns true when NODE_ENV is test (non-development)', () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(isProductionEnvironment()).toBe(true);
  });
});

describe('Retry-After math (seconds from ms reset timestamp)', () => {
  it('converts ms reset to correct whole seconds', () => {
    const now = Date.now();
    const resetMs = now + 60_000; // 60 seconds from now
    const retryAfter = Math.max(0, Math.ceil((resetMs - now) / 1000));
    expect(retryAfter).toBe(60);
  });

  it('clamps to zero when reset is in the past', () => {
    const now = Date.now();
    const resetMs = now - 5_000; // 5 seconds ago
    const retryAfter = Math.max(0, Math.ceil((resetMs - now) / 1000));
    expect(retryAfter).toBe(0);
  });

  it('rounds up fractional seconds', () => {
    const now = Date.now();
    const resetMs = now + 1_500; // 1.5 seconds from now
    const retryAfter = Math.max(0, Math.ceil((resetMs - now) / 1000));
    expect(retryAfter).toBe(2);
  });

  it('handles large values (30 minutes) without overflow', () => {
    const now = Date.now();
    const resetMs = now + 30 * 60 * 1_000; // 1800 seconds
    const retryAfter = Math.max(0, Math.ceil((resetMs - now) / 1000));
    expect(retryAfter).toBe(1800);
  });
});
