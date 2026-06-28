/**
 * Tests for wallet-rebuilder
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { rebuildUserWallet, rebuildAllWallets } from './wallet-rebuilder';

// Mock D1 binding — supports both .prepare().bind().all() and .prepare().all()
const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn();
// bind returns an object with all/first/run; prepare itself also has all (for no-bind queries)
const mockBind = vi.fn(() => ({ all: mockAll, first: mockFirst, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind, all: mockAll, first: mockFirst, run: mockRun }));
const mockDb = { prepare: mockPrepare };

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: mockDb };
  mockRun.mockResolvedValue({ success: true });
});

describe('rebuildUserWallet', () => {
  it('computes 3 balance buckets and upserts wallet', async () => {
    mockAll.mockResolvedValue({
      results: [
        { payout_status: 'pending_clearance', total: 50 },
        { payout_status: 'available', total: 100 },
        { payout_status: 'paid', total: 200 },
      ],
    });

    await rebuildUserWallet('user-1');

    // Should have called prepare twice: SELECT + UPSERT
    expect(mockPrepare).toHaveBeenCalledTimes(2);
    // The UPSERT bind should receive 0 for unmatched statuses
    expect(mockBind).toHaveBeenCalledWith('user-1', 50, 100, 200);
  });

  it('defaults to 0 for missing payout_status buckets', async () => {
    // Only pending_clearance rows, no available or paid
    mockAll.mockResolvedValue({
      results: [{ payout_status: 'pending_clearance', total: 75 }],
    });

    await rebuildUserWallet('user-2');

    expect(mockBind).toHaveBeenCalledWith('user-2', 75, 0, 0);
  });

  it('ignores reversed/unattributed rows', async () => {
    mockAll.mockResolvedValue({
      results: [
        { payout_status: 'available', total: 30 },
        { payout_status: 'reversed', total: 10 },
        { payout_status: 'unattributed', total: 5 },
      ],
    });

    await rebuildUserWallet('user-3');

    // reversed and unattributed should not be counted
    expect(mockBind).toHaveBeenCalledWith('user-3', 0, 30, 0);
  });

  it('handles empty results (no conversions for user)', async () => {
    mockAll.mockResolvedValue({ results: [] });

    await rebuildUserWallet('user-4');

    expect(mockBind).toHaveBeenCalledWith('user-4', 0, 0, 0);
  });
});

describe('rebuildAllWallets', () => {
  it('iterates all distinct users and rebuilds each', async () => {
    // First call: DISTINCT user_id query
    // Subsequent calls: per-user balance SELECT + UPSERT
    let callCount = 0;
    mockAll.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          results: [{ user_id: 'user-a' }, { user_id: 'user-b' }],
        });
      }
      // Balance rows for each user
      return Promise.resolve({ results: [{ payout_status: 'available', total: 50 }] });
    });

    const result = await rebuildAllWallets();

    expect(result.count).toBe(2);
  });

  it('returns count=0 when no users have conversions', async () => {
    mockAll.mockResolvedValue({ results: [] });

    const result = await rebuildAllWallets();

    expect(result.count).toBe(0);
  });

  it('continues on per-user error and logs it', async () => {
    let callCount = 0;
    mockAll.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ results: [{ user_id: 'user-x' }, { user_id: 'user-y' }] });
      }
      if (callCount === 2) {
        return Promise.reject(new Error('D1 error'));
      }
      return Promise.resolve({ results: [{ payout_status: 'available', total: 20 }] });
    });

    const result = await rebuildAllWallets();

    // user-x failed, user-y succeeded
    expect(result.count).toBe(1);
  });
});
