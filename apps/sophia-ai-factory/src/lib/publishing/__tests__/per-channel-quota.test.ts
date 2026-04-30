import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkQuota, consumeQuota, DAILY_QUOTAS } from '../per-channel-quota';

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('per-channel-quota', () => {
  beforeEach(() => {
    // Clear module-level memStore between tests by resetting env
    // The in-memory map persists in module scope; use unique channelIds per test
  });

  it('DAILY_QUOTAS are correct', () => {
    expect(DAILY_QUOTAS.tiktok).toBe(30);
    expect(DAILY_QUOTAS.youtube).toBe(50);
    expect(DAILY_QUOTAS.instagram).toBe(25);
  });

  it('checkQuota returns allowed for new channel', async () => {
    const result = await checkQuota('ch_new_1', 'tiktok');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.limit).toBe(30);
  });

  it('consumeQuota increments and allows until limit', async () => {
    const channelId = `ch_tiktok_${Date.now()}_consume`;

    // First consume
    const r1 = await consumeQuota(channelId, 'tiktok');
    expect(r1.allowed).toBe(true);
    expect(r1.used).toBe(1);

    // Second consume
    const r2 = await consumeQuota(channelId, 'tiktok');
    expect(r2.allowed).toBe(true);
    expect(r2.used).toBe(2);
  });

  it('consumeQuota blocks after TikTok 30/day limit', async () => {
    const channelId = `ch_tiktok_block_${Date.now()}`;

    // Fill up quota
    for (let i = 0; i < 30; i++) {
      const r = await consumeQuota(channelId, 'tiktok');
      expect(r.allowed).toBe(true);
    }

    // 31st should be blocked
    const blocked = await consumeQuota(channelId, 'tiktok');
    expect(blocked.allowed).toBe(false);
    expect(blocked.used).toBe(30);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('consumeQuota blocks after Instagram 25/day limit', async () => {
    const channelId = `ch_ig_block_${Date.now()}`;

    for (let i = 0; i < 25; i++) {
      await consumeQuota(channelId, 'instagram');
    }

    const blocked = await consumeQuota(channelId, 'instagram');
    expect(blocked.allowed).toBe(false);
    expect(blocked.limit).toBe(25);
  });

  it('checkQuota does not increment counter', async () => {
    const channelId = `ch_check_noinc_${Date.now()}`;
    const before = await checkQuota(channelId, 'youtube');
    await checkQuota(channelId, 'youtube');
    const after = await checkQuota(channelId, 'youtube');
    expect(before.used).toBe(after.used);
  });

  it('retryAfterSeconds is positive', async () => {
    const result = await checkQuota('ch_rta', 'youtube');
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(86400);
  });
});
