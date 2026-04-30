/**
 * rate-limit.test.ts
 *
 * Tests must run sequentially since rateLimitGate uses shared in-memory bucket.
 * Clears __env.KV to force in-memory fallback (avoids mock KV always returning null).
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { rateLimitGate, _clearMemoryBuckets } from '../rate-limit';

describe.sequential('rateLimitGate', () => {
  let savedKV: unknown;

  beforeAll(() => {
    const g = globalThis as unknown as Record<string, Record<string, unknown>>;
    savedKV = g.__env?.KV;
    if (g.__env) g.__env = { ...g.__env, KV: undefined };
  });

  afterAll(() => {
    const g = globalThis as unknown as Record<string, Record<string, unknown>>;
    if (g.__env) g.__env = { ...g.__env, KV: savedKV };
  });

  beforeEach(() => {
    _clearMemoryBuckets();
  });

  it('allows requests within limit', async () => {
    const result = await rateLimitGate('tenant-a', 'video-gen', 5, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('decrements remaining on each call', async () => {
    for (let i = 4; i >= 1; i--) {
      const r = await rateLimitGate('tenant-dec', 'api', 5, 60);
      expect(r.remaining).toBe(i);
    }
  });

  it('blocks when over limit and returns retryAfter', async () => {
    for (let i = 0; i < 3; i++) {
      await rateLimitGate('tenant-block', 'writes', 3, 60);
    }

    const result = await rateLimitGate('tenant-block', 'writes', 3, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('tenants are isolated — different buckets', async () => {
    for (let i = 0; i < 2; i++) {
      await rateLimitGate('tenant-x', 'resource', 2, 60);
    }
    const blocked = await rateLimitGate('tenant-x', 'resource', 2, 60);
    expect(blocked.allowed).toBe(false);

    const fresh = await rateLimitGate('tenant-y', 'resource', 2, 60);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(1);
  });

  it('different resources for same tenant are isolated', async () => {
    for (let i = 0; i < 2; i++) {
      await rateLimitGate('tenant-res', 'video', 2, 60);
    }
    const videoBlocked = await rateLimitGate('tenant-res', 'video', 2, 60);
    expect(videoBlocked.allowed).toBe(false);

    const api = await rateLimitGate('tenant-res', 'api', 2, 60);
    expect(api.allowed).toBe(true);
  });

  it('retryAfter is positive seconds', async () => {
    await rateLimitGate('tenant-retry', 'op', 1, 30);
    const r = await rateLimitGate('tenant-retry', 'op', 1, 30);
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
    expect(r.retryAfter).toBeLessThanOrEqual(30);
  });
});
