/**
 * Affiliate NET-30 Payout Tests
 *
 * Covers aggregation, threshold gating, approval routing, and the payout
 * rails' idempotency contract. The pure helpers are tested directly; the
 * DB-touching runner is driven against a mocked D1 so the SQL contract
 * (payable + hold elapsed + unclaimed) is asserted.
 *
 * @module forest/inngest/functions/__tests__/affiliate-net30-payout.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockCreatePayout } = vi.hoisted(() => ({ mockCreatePayout: vi.fn() }));
const { mockApprovePayout } = vi.hoisted(() => ({ mockApprovePayout: vi.fn() }));
const { mockLinkCommissions } = vi.hoisted(() => ({ mockLinkCommissions: vi.fn() }));
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/tree/affiliates/ledger/payout-disbursement', () => ({
  createPayoutDisbursement: mockCreatePayout,
}));
vi.mock('@/tree/affiliates/ledger/payout-lifecycle', () => ({
  approvePayoutDisbursement: mockApprovePayout,
}));
vi.mock('@/tree/affiliates/ledger/commission-payout-linker', () => ({
  linkCommissionsToPayout: mockLinkCommissions,
}));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: mockLogger }));

import {
  aggregateByPartner,
  isAboveMinimum,
  needsAdminApproval,
  summarizePayoutRun,
  runNet30PayoutJob,
} from '@/forest/inngest/functions/affiliate-net30-payout';
import {
  AFFILIATE_MIN_PAYOUT_CENTS,
  AFFILIATE_AUTO_APPROVE_MAX_CENTS,
} from '@/seed/config/revenue-share';

interface D1Prepared {
  bind: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
}

function makeDb(rows: Array<{ partner_id: string; commission_count: number; total_cents: number | null }>) {
  const all = vi.fn().mockResolvedValue({ results: rows });
  const bind = vi.fn((): D1Prepared => ({ bind, all }));
  const prepare = vi.fn((_sql: string) => ({ bind, all }));
  return { prepare, bind, all };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLinkCommissions.mockResolvedValue({ success: true, reservedCount: 1 });
});

describe('threshold constants', () => {
  it('minimum payout is $50 and auto-approve ceiling is $500', () => {
    expect(AFFILIATE_MIN_PAYOUT_CENTS).toBe(5000);
    expect(AFFILIATE_AUTO_APPROVE_MAX_CENTS).toBe(50_000);
  });

  it('minimum is inclusive and ceiling is inclusive', () => {
    expect(isAboveMinimum(4999)).toBe(false);
    expect(isAboveMinimum(5000)).toBe(true);
    expect(needsAdminApproval(50_000)).toBe(false);
    expect(needsAdminApproval(50_001)).toBe(true);
  });
});

describe('aggregateByPartner', () => {
  it('sums multiple commission rows per partner', () => {
    const plans = aggregateByPartner([
      { partner_id: 'p1', commission_count: 2, total_cents: 3000 },
      { partner_id: 'p1', commission_count: 1, total_cents: 2000 },
      { partner_id: 'p2', commission_count: 3, total_cents: 9000 },
    ]);

    expect(plans).toHaveLength(2);
    expect(plans.find((p) => p.partnerId === 'p1')).toEqual({
      partnerId: 'p1',
      amountCents: 5000,
      commissionCount: 3,
    });
    expect(plans.find((p) => p.partnerId === 'p2')).toEqual({
      partnerId: 'p2',
      amountCents: 9000,
      commissionCount: 3,
    });
  });

  it('treats a null total as zero rather than NaN', () => {
    const plans = aggregateByPartner([
      { partner_id: 'p1', commission_count: 1, total_cents: null },
    ]);

    expect(plans[0]?.amountCents).toBe(0);
    expect(plans[0]?.commissionCount).toBe(1);
  });

  it('preserves negative clawback totals so under-minimum partners are skipped', () => {
    const plans = aggregateByPartner([
      { partner_id: 'p1', commission_count: 2, total_cents: -1500 },
    ]);

    expect(plans[0]?.amountCents).toBe(-1500);
  });

  it('returns an empty plan list for no commissions', () => {
    expect(aggregateByPartner([])).toEqual([]);
  });
});

describe('summarizePayoutRun', () => {
  it('counts each routing status and sums only created payouts', () => {
    const base = { partnerId: 'p', amountCents: 0, commissionCount: 1 };
    const summary = summarizePayoutRun(
      [
        { ...base, partnerId: 'a', amountCents: 10_000, status: 'pending_approval' },
        { ...base, partnerId: 'b', amountCents: 3000, status: 'auto_approved' },
        { ...base, partnerId: 'c', amountCents: 100, status: 'skipped_below_minimum' },
        { ...base, partnerId: 'd', status: 'failed', reason: 'OCC' },
      ],
      4,
    );

    expect(summary.partnerCount).toBe(4);
    expect(summary.pendingApprovalCount).toBe(1);
    expect(summary.autoApprovedCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.createdCount).toBe(2);
    expect(summary.totalAmountCents).toBe(13_000);
  });

  it('reports zero created when every partner is under the minimum', () => {
    const summary = summarizePayoutRun(
      [{ partnerId: 'a', amountCents: 4999, commissionCount: 1, status: 'skipped_below_minimum' }],
      1,
    );

    expect(summary.createdCount).toBe(0);
    expect(summary.totalAmountCents).toBe(0);
  });
});

describe('runNet30PayoutJob — routing', () => {
  it('skips partners below the $50 minimum', async () => {
    const db = makeDb([{ partner_id: 'p1', commission_count: 1, total_cents: 4999 }]);

    const result = await runNet30PayoutJob(db as never);

    expect(result.skippedCount).toBe(1);
    expect(mockCreatePayout).not.toHaveBeenCalled();
    expect(result.outcomes[0]).toMatchObject({ status: 'skipped_below_minimum' });
  });

  it('auto-approves a $120 payout at exactly the minimum', async () => {
    const db = makeDb([{ partner_id: 'p1', commission_count: 3, total_cents: 12_000 }]);
    mockCreatePayout.mockResolvedValue({ success: true, payoutId: 'po_1', payoutReference: 'PO_X' });

    const result = await runNet30PayoutJob(db as never);

    expect(mockCreatePayout).toHaveBeenCalledTimes(1);
    expect(mockApprovePayout).toHaveBeenCalledWith(
      expect.objectContaining({ payoutId: 'po_1', approvedBy: 'system:net30' }),
    );
    expect(result.autoApprovedCount).toBe(1);
    expect(result.outcomes[0]).toMatchObject({ status: 'auto_approved' });
  });

  it('routes a $600 payout to pending_approval without approving', async () => {
    const db = makeDb([{ partner_id: 'p1', commission_count: 5, total_cents: 60_000 }]);
    mockCreatePayout.mockResolvedValue({ success: true, payoutId: 'po_2', payoutReference: 'PO_Y' });

    const result = await runNet30PayoutJob(db as never);

    expect(mockCreatePayout).toHaveBeenCalledTimes(1);
    expect(mockApprovePayout).not.toHaveBeenCalled();
    expect(result.pendingApprovalCount).toBe(1);
    expect(result.outcomes[0]).toMatchObject({ status: 'pending_approval', payoutId: 'po_2' });
  });

  it('marks the outcome failed when the payout rails refuse', async () => {
    const db = makeDb([{ partner_id: 'p1', commission_count: 2, total_cents: 20_000 }]);
    mockCreatePayout.mockResolvedValue({ success: false, error: 'PARTNER_INACTIVE' });

    const result = await runNet30PayoutJob(db as never);

    expect(result.failedCount).toBe(1);
    expect(mockApprovePayout).not.toHaveBeenCalled();
    expect(result.outcomes[0]).toMatchObject({ status: 'failed', reason: 'PARTNER_INACTIVE' });
  });

  it('continues past a throwing rail to settle remaining partners', async () => {
    const db = makeDb([
      { partner_id: 'p1', commission_count: 1, total_cents: 20_000 },
      { partner_id: 'p2', commission_count: 1, total_cents: 30_000 },
    ]);
    mockCreatePayout
      .mockRejectedValueOnce(new Error('D1 transient'))
      .mockResolvedValueOnce({ success: true, payoutId: 'po_ok', payoutReference: 'PO_OK' });

    const result = await runNet30PayoutJob(db as never);

    expect(result.failedCount).toBe(1);
    expect(result.autoApprovedCount).toBe(1);
    expect(result.partnerCount).toBe(2);
  });

  it('does nothing when no commissions are mature', async () => {
    const db = makeDb([]);

    const result = await runNet30PayoutJob(db as never);

    expect(result.partnerCount).toBe(0);
    expect(result.createdCount).toBe(0);
    expect(mockCreatePayout).not.toHaveBeenCalled();
  });

  it('queries only payable, hold-elapsed, unclaimed commissions', async () => {
    const db = makeDb([]);

    await runNet30PayoutJob(db as never);

    const sql = db.prepare.mock.calls[0]?.[0] ?? '';
    expect(sql).toContain('affiliate_commissions');
    expect(sql).toContain("status = 'payable'");
    expect(sql).toContain('payout_id IS NULL');
    expect(sql).toContain('payable_at');
  });
});

describe('runNet30PayoutJob — commission reservation', () => {
  beforeEach(() => {
    mockCreatePayout.mockResolvedValue({ success: true, payoutId: 'po_1', payoutReference: 'PO_X' });
  })

  it('reserves every swept commission against the payout it paid from', async () => {
    const db = makeDb([{ partner_id: 'p1', commission_count: 3, total_cents: 12_000 }]);

    await runNet30PayoutJob(db as never);

    expect(mockLinkCommissions).toHaveBeenCalledTimes(1);
    expect(mockLinkCommissions).toHaveBeenCalledWith(
      expect.objectContaining({ payoutId: 'po_1', partnerId: 'p1' }),
    );
  })

  it('warns when fewer commissions were reserved than the run aggregated', async () => {
    mockLinkCommissions.mockResolvedValue({ success: true, reservedCount: 2 });
    const db = makeDb([{ partner_id: 'p1', commission_count: 3, total_cents: 12_000 }]);

    await runNet30PayoutJob(db as never);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Reserved fewer commissions'),
      expect.objectContaining({ aggregated: 3, reserved: 2 }),
    );
  })

  it('still approves the payout when the reservation fails, but reports it', async () => {
    mockLinkCommissions.mockResolvedValue({ success: false, error: 'D1_TIME' })
    const db = makeDb([{ partner_id: 'p1', commission_count: 3, total_cents: 12_000 }]);

    const result = await runNet30PayoutJob(db as never);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('commissions not reserved'),
      expect.objectContaining({ reason: 'D1_TIME' }),
    );
    expect(result.autoApprovedCount).toBe(1);
  })

  it('reserves nothing when the payout could not be created', async () => {
    mockCreatePayout.mockResolvedValue({ success: false, error: 'PARTNER_INACTIVE' })
    const db = makeDb([{ partner_id: 'p1', commission_count: 3, total_cents: 12_000 }])

    const result = await runNet30PayoutJob(db as never)

    expect(mockLinkCommissions).not.toHaveBeenCalled()
    expect(result.failedCount).toBe(1)
  })

  it('reserves before approving so a crash between the two still leaves a claim', async () => {
    const order: string[] = []
    mockCreatePayout.mockImplementation(async () => {
      order.push('create')
      return { success: true, payoutId: 'po_1', payoutReference: 'PO_X' }
    })
    mockLinkCommissions.mockImplementation(async () => {
      order.push('reserve')
      return { success: true, reservedCount: 3 }
    })
    mockApprovePayout.mockImplementation(async () => {
      order.push('approve')
      return { success: true }
    })
    const db = makeDb([{ partner_id: 'p1', commission_count: 3, total_cents: 12_000 }])

    await runNet30PayoutJob(db as never)

    expect(order).toEqual(['create', 'reserve', 'approve'])
  })
})
