import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearUserTierCache, getUserTier, invalidateUserTierCache } from './get-user-tier';
import { getD1 } from '@/seed/db/client';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

const mockGetD1 = vi.mocked(getD1);

describe('getUserTier and cache layer', () => {
  beforeEach(() => {
    clearUserTierCache();
    vi.clearAllMocks();
  });

  it('returns BASIC on empty or null userId without hitting D1', async () => {
    const res = await getUserTier('');
    expect(res).toBe('BASIC');
    expect(mockGetD1).not.toHaveBeenCalled();
  });

  it('fetches user tier from subscriptions and caches subsequent calls', async () => {
    const firstFn = vi.fn().mockResolvedValue({ tier: 'ENTERPRISE', plan: 'enterprise' });
    const bindFn = vi.fn().mockReturnValue({ first: firstFn });
    const prepareFn = vi.fn().mockReturnValue({ bind: bindFn });
    const mockDb = { prepare: prepareFn } as unknown as D1Database;

    mockGetD1.mockResolvedValue(mockDb);

    // Call 1: Misses cache, hits D1
    const res1 = await getUserTier('user-123');
    expect(res1).toBe('ENTERPRISE');
    expect(prepareFn).toHaveBeenCalledTimes(1);

    // Call 2: Hits L1 cache, does not hit D1
    const res2 = await getUserTier('user-123');
    expect(res2).toBe('ENTERPRISE');
    expect(prepareFn).toHaveBeenCalledTimes(1);
  });

  it('normalizes lowercase plan aliases correctly', async () => {
    const firstFn = vi.fn().mockResolvedValue({ tier: null, plan: 'pro' });
    const bindFn = vi.fn().mockReturnValue({ first: firstFn });
    const prepareFn = vi.fn().mockReturnValue({ bind: bindFn });
    const mockDb = { prepare: prepareFn } as unknown as D1Database;

    mockGetD1.mockResolvedValue(mockDb);

    const res = await getUserTier('user-pro');
    expect(res).toBe('PREMIUM');
  });

  it('invalidates cache via invalidateUserTierCache', async () => {
    const firstFn = vi.fn().mockResolvedValue({ tier: 'MASTER', plan: 'master' });
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

  it('clears all cached items via clearUserTierCache', async () => {
    const firstFn = vi.fn().mockResolvedValue({ tier: 'PREMIUM', plan: 'pro' });
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
