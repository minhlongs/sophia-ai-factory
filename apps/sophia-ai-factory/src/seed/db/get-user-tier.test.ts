import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearUserTierCache, getUserTier, invalidateUserTierCache } from './get-user-tier';
import { getD1 } from '@/seed/db/client';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

const mockGetD1 = vi.mocked(getD1);

describe('getUserTier authoritative subscription lookup', () => {
  beforeEach(() => {
    clearUserTierCache();
    vi.clearAllMocks();
  });

  it('returns BASIC on empty or null userId without hitting D1', async () => {
    const res = await getUserTier('');
    expect(res).toBe('BASIC');
    expect(mockGetD1).not.toHaveBeenCalled();
  });

  it('re-reads the active subscription so a refunded tier is not served from cache', async () => {
    const firstFn = vi.fn()
      .mockResolvedValueOnce({ raw_tier: 'PREMIUM' })
      .mockResolvedValueOnce(null);
    const bindFn = vi.fn().mockReturnValue({ first: firstFn });
    const prepareFn = vi.fn().mockReturnValue({ bind: bindFn });
    const mockDb = { prepare: prepareFn } as unknown as D1Database;

    mockGetD1.mockResolvedValue(mockDb);

    const res1 = await getUserTier('user-123');
    expect(res1).toBe('PREMIUM');
    expect(prepareFn).toHaveBeenCalledTimes(1);

    const res2 = await getUserTier('user-123');
    expect(res2).toBe('BASIC');
    expect(prepareFn).toHaveBeenCalledTimes(2); // both requests read D1; the second bypasses any stale cache
  });

  it('normalizes lowercase plan aliases correctly', async () => {
    const firstFn = vi.fn().mockResolvedValue({ raw_tier: 'pro' });
    const bindFn = vi.fn().mockReturnValue({ first: firstFn });
    const prepareFn = vi.fn().mockReturnValue({ bind: bindFn });
    const mockDb = { prepare: prepareFn } as unknown as D1Database;

    mockGetD1.mockResolvedValue(mockDb);

    const res = await getUserTier('user-pro');
    expect(res).toBe('PREMIUM');
  });

  it('refreshes subscription state after legacy cache invalidation', async () => {
    const firstFn = vi.fn().mockResolvedValue({ raw_tier: 'MASTER' });
    const bindFn = vi.fn().mockReturnValue({ first: firstFn });
    const prepareFn = vi.fn().mockReturnValue({ bind: bindFn });
    const mockDb = { prepare: prepareFn } as unknown as D1Database;

    mockGetD1.mockResolvedValue(mockDb);

    await getUserTier('user-456');
    expect(prepareFn).toHaveBeenCalledTimes(1);

    // Invalidate specific user
    invalidateUserTierCache('user-456');

    // Should query D1 again
    await getUserTier('user-456');
    expect(prepareFn).toHaveBeenCalledTimes(2);
  });

  it('continues resolving current subscriptions after clearing legacy cache entries', async () => {
    const firstFn = vi.fn().mockResolvedValue({ raw_tier: 'PREMIUM' });
    const bindFn = vi.fn().mockReturnValue({ first: firstFn });
    const prepareFn = vi.fn().mockReturnValue({ bind: bindFn });
    const mockDb = { prepare: prepareFn } as unknown as D1Database;

    mockGetD1.mockResolvedValue(mockDb);

    await getUserTier('user-a');
    await getUserTier('user-b');
    expect(prepareFn).toHaveBeenCalledTimes(2);

    clearUserTierCache();

    await getUserTier('user-a');
    expect(prepareFn).toHaveBeenCalledTimes(3);
  });
});
