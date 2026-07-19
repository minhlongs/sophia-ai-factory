/**
 * Tests for channel-cooldown.ts
 * Uses in-memory fallback path (no D1 available in unit tests).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkCooldown,
  recordPostInMemory,
  _resetMemStoreForTests,
} from '../channel-cooldown';
import {
  CHANNEL_COOLDOWN_SECONDS,
  BURST_LIMIT_PER_HOUR,
  BURST_WINDOW_SECONDS,
} from '@/seed/config/channel-cooldown-rules';

// Mock D1 client so tests always use in-memory path
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => null),
}));

const TENANT = 'tenant-1';
const CHANNEL = 'channel-tiktok-1';
const PROVIDER = 'tiktok' as const;

describe('checkCooldown (in-memory path)', () => {
  beforeEach(() => {
    _resetMemStoreForTests();
  });

  it('allows first post with no history', async () => {
    const result = await checkCooldown(TENANT, CHANNEL, PROVIDER);
    expect(result.allowed).toBe(true);
    expect(result.deferUntil).toBeUndefined();
  });

  it('blocks post within cooldown window', async () => {
    const now = 1_000_000;
    // Record a post 1 hour ago (TikTok cooldown = 4h)
    recordPostInMemory(TENANT, CHANNEL, now - 3600);

    const result = await checkCooldown(TENANT, CHANNEL, PROVIDER, now);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('cooldown');
    expect(result.deferUntil).toBeDefined();
    // deferUntil should be lastPost + 4h
    expect(result.deferUntil).toBe(now - 3600 + CHANNEL_COOLDOWN_SECONDS[PROVIDER]);
    expect(result.deferSeconds).toBeGreaterThan(0);
  });

  it('allows post after cooldown has elapsed', async () => {
    const now = 1_000_000;
    const cooldown = CHANNEL_COOLDOWN_SECONDS[PROVIDER]; // 4h
    // Record a post 5 hours ago
    recordPostInMemory(TENANT, CHANNEL, now - cooldown - 3600);

    const result = await checkCooldown(TENANT, CHANNEL, PROVIDER, now);
    expect(result.allowed).toBe(true);
  });

  it('blocks on burst: 3 posts in last hour', async () => {
    const now = 1_000_000;
    // Record BURST_LIMIT_PER_HOUR posts within the burst window
    for (let i = 0; i < BURST_LIMIT_PER_HOUR; i++) {
      recordPostInMemory(TENANT, CHANNEL, now - 60 * (i + 1));
    }

    const result = await checkCooldown(TENANT, CHANNEL, PROVIDER, now);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('burst');
    expect(result.deferUntil).toBeDefined();
    expect((result.deferUntil as number)).toBeGreaterThan(now);
  });

  it('allows post if burst posts are outside the window (and outside cooldown too)', async () => {
    const now = 1_000_000;
    const cooldown = CHANNEL_COOLDOWN_SECONDS[PROVIDER]; // tiktok: 4h = 14400s
    // Record BURST_LIMIT_PER_HOUR posts outside BOTH burst window AND cooldown window
    // Place them at now - (cooldown + 1h + offset) to be safely outside both
    for (let i = 0; i < BURST_LIMIT_PER_HOUR; i++) {
      recordPostInMemory(TENANT, CHANNEL, now - cooldown - BURST_WINDOW_SECONDS - 60 * (i + 1));
    }

    const result = await checkCooldown(TENANT, CHANNEL, PROVIDER, now);
    expect(result.allowed).toBe(true);
  });

  it('uses correct cooldown for telegram (5 min)', async () => {
    const now = 1_000_000;
    // Record a post 3 minutes ago — within 5-min cooldown
    recordPostInMemory(TENANT, 'channel-tg-1', now - 180);

    const result = await checkCooldown(TENANT, 'channel-tg-1', 'telegram', now);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('cooldown');
  });

  it('uses correct cooldown for twitter (15 min)', async () => {
    const now = 1_000_000;
    // Record a post 10 minutes ago — within 15-min cooldown
    recordPostInMemory(TENANT, 'channel-tw-1', now - 600);

    const result = await checkCooldown(TENANT, 'channel-tw-1', 'twitter', now);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('cooldown');
  });

  it('deferUntil uses max(requested, deferUntil) — deferral logic', async () => {
    const now = 1_000_000;
    const cooldown = CHANNEL_COOLDOWN_SECONDS['instagram']; // 2h
    const lastPost = now - 3600; // 1h ago
    recordPostInMemory(TENANT, 'channel-ig-1', lastPost);

    const result = await checkCooldown(TENANT, 'channel-ig-1', 'instagram', now);
    expect(result.allowed).toBe(false);
    // Expected deferUntil = lastPost + 2h = now - 3600 + 7200 = now + 3600
    expect(result.deferUntil).toBe(lastPost + cooldown);
    expect(result.deferSeconds).toBe(3600);
  });

  it('isolates channels — different channels are independent', async () => {
    const now = 1_000_000;
    // Record post on channel A (within cooldown)
    recordPostInMemory(TENANT, 'channel-a', now - 100);
    // Channel B has no history
    const resultB = await checkCooldown(TENANT, 'channel-b', 'instagram', now);
    expect(resultB.allowed).toBe(true);
  });

  it('isolates tenants — same channel different tenants are independent', async () => {
    const now = 1_000_000;
    recordPostInMemory('tenant-X', CHANNEL, now - 100);

    // tenant-Y should be unaffected
    const result = await checkCooldown('tenant-Y', CHANNEL, PROVIDER, now);
    expect(result.allowed).toBe(true);
  });
});

describe('recordPostInMemory', () => {
  beforeEach(() => {
    _resetMemStoreForTests();
  });

  it('updates store so subsequent check reflects the new post', async () => {
    const now = 1_000_000;
    recordPostInMemory(TENANT, CHANNEL, now - 10);

    const result = await checkCooldown(TENANT, CHANNEL, PROVIDER, now);
    expect(result.allowed).toBe(false); // TikTok 4h cooldown not elapsed
    expect(result.reason).toBe('cooldown');
  });
});
