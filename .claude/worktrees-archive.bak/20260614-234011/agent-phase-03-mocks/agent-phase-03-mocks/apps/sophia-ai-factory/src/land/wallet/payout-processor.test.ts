/**
 * Tests for payout-processor
 * Verifies: threshold enforcement, balance match, atomic UPDATE-RETURNING, reconciliation, idempotency
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./wallet-rebuilder', () => ({
  rebuildUserWallet: vi.fn().mockResolvedValue(undefined),
}));

import { markUserPaid } from './payout-processor';
import { rebuildUserWallet } from './wallet-rebuilder';

// New pattern: prepare(sql).bind(...).all() for UPDATE-RETURNING
// and prepare(sql).bind(...).run() for revert + insert
let mockAll: ReturnType<typeof vi.fn>;
let mockRun: ReturnType<typeof vi.fn>;
let mockBind: ReturnType<typeof vi.fn>;
let mockPrepare: ReturnType<typeof vi.fn>;
let mockDb: { prepare: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();

  mockAll = vi.fn();
  mockRun = vi.fn().mockResolvedValue({ success: true });
  mockBind = vi.fn(() => ({ all: mockAll, run: mockRun }));
  mockPrepare = vi.fn(() => ({ bind: mockBind }));
  mockDb = { prepare: mockPrepare };

  (globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: mockDb };

  // Default: UPDATE-RETURNING returns 1 conversion with 100 commission
  mockAll.mockResolvedValue({ results: [{ commission_user: 100 }] });
});

const validParams = {
  userId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  amount: 100,
  method: 'usdt_trc20' as const,
  reference: 'tx_abc123',
  adminId: 'admin-user-id',
};

describe('markUserPaid', () => {
  it('rejects amount below MIN_PAYOUT_USD (50)', async () => {
    await expect(
      markUserPaid({ ...validParams, amount: 49.99 })
    ).rejects.toThrow('below minimum payout threshold');
  });

  it('rejects when no conversions exist for user (empty RETURNING result)', async () => {
    // UPDATE-RETURNING returns empty = no available conversions = "no wallet"
    mockAll.mockResolvedValue({ results: [] });

    await expect(markUserPaid(validParams)).rejects.toThrow('No wallet found');
  });

  it('rejects when actualPaid does not match requested amount — reverts and throws', async () => {
    // user has 200 in conversions, but admin tries to pay 100
    mockAll.mockResolvedValue({ results: [{ commission_user: 200 }] });

    await expect(markUserPaid(validParams)).rejects.toThrow('does not match available balance');

    // Revert UPDATE must have been called
    const sqls = (mockPrepare as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    const hasRevert = sqls.some((s) => s.includes("payout_status = 'available'") && s.includes('payout_id = ?'));
    expect(hasRevert).toBe(true);
  });

  it('performs UPDATE-RETURNING then INSERT and returns payoutId', async () => {
    const result = await markUserPaid(validParams);

    expect(result).toHaveProperty('payoutId');
    expect(typeof result.payoutId).toBe('string');
    expect(result.payoutId.length).toBe(32); // 16 bytes hex

    // Verify UPDATE-RETURNING SQL was called
    const sqls = (mockPrepare as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    const hasUpdateReturning = sqls.some((s) => s.includes('RETURNING') && s.includes('commission_user'));
    expect(hasUpdateReturning).toBe(true);

    // Verify INSERT payout was called
    const hasInsert = sqls.some((s) => s.includes('INSERT INTO payouts'));
    expect(hasInsert).toBe(true);
  });

  it('calls rebuildUserWallet after successful payout', async () => {
    await markUserPaid(validParams);

    expect(rebuildUserWallet).toHaveBeenCalledWith(validParams.userId);
  });

  it('idempotency: second call when no available conversions throws "No wallet found"', async () => {
    // After first payout, no more available conversions
    mockAll.mockResolvedValue({ results: [] });

    await expect(
      markUserPaid({ ...validParams, amount: 100 })
    ).rejects.toThrow('No wallet found');
  });

  it('allows floating-point tolerance of ±0.01 (sum ≈ requested amount)', async () => {
    // Two conversions summing to 99.999 — within ±0.01 tolerance of 100
    mockAll.mockResolvedValue({
      results: [{ commission_user: 70.0 }, { commission_user: 29.999 }],
    });

    const result = await markUserPaid({ ...validParams, amount: 100 });

    // Should not throw — within tolerance; payoutId returned
    expect(result).toHaveProperty('payoutId');
    expect(typeof result.payoutId).toBe('string');
  });

  it('continues when rebuildUserWallet throws (non-fatal)', async () => {
    (rebuildUserWallet as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('rebuild failed'));

    // Should not throw — rebuild failure is non-fatal
    const result = await markUserPaid(validParams);
    expect(result).toHaveProperty('payoutId');
  });
});
