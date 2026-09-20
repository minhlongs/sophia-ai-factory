import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  calculatePayableAt,
  recordCommissionEntry,
  recordClawbackAdjustment,
  flipPendingToPayable,
  getNetAffiliateBalance,
  getAffiliateBalanceBreakdown,
} from '../commission-ledger';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS commission_ledger (
      id TEXT PRIMARY KEY,
      affiliate_id TEXT NOT NULL,
      network TEXT NOT NULL,
      external_conversion_id TEXT NOT NULL,
      sub_id TEXT,
      order_value_cents INTEGER NOT NULL DEFAULT 0,
      commission_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'payable', 'paying', 'paid', 'clawback')),
      hold_days INTEGER NOT NULL DEFAULT 14,
      attributed_at INTEGER NOT NULL,
      payable_at INTEGER NOT NULL,
      payout_batch_id TEXT,
      parent_id TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(network, external_conversion_id)
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0) } };
            },
            all: async <T>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0 } };
            },
          };
        },
        first: async <T>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0) } };
        },
        all: async <T>() => {
          return { results: stmt.all() as T[], meta: { changes: 0 } };
        },
      };
    },
  } as unknown as D1Database;
}

describe('Commission Ledger (tree/affiliate/commission-ledger)', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('calculatePayableAt', () => {
    it('computes exact 14-day hold duration in milliseconds', () => {
      const attributedAt = 1_700_000_000_000;
      const expected = attributedAt + 14 * 86_400 * 1_000;
      expect(calculatePayableAt(attributedAt, 14)).toBe(expected);
      expect(calculatePayableAt(attributedAt)).toBe(expected);
    });
  });

  describe('recordCommissionEntry', () => {
    it('inserts positive commission row with status pending', async () => {
      const res = await recordCommissionEntry(db, {
        affiliateId: 'aff_01',
        network: 'tiktok_shop',
        externalConversionId: 'conv_101',
        orderValueCents: 5000,
        commissionCents: 1000,
        attributedAt: 1000,
        payableAt: 2000,
      });

      expect(res.success).toBe(true);
      expect(res.duplicate).toBeUndefined();
      expect(res.commissionCents).toBe(1000);

      const row = await db
        .prepare('SELECT * FROM commission_ledger WHERE external_conversion_id = ?')
        .bind('conv_101')
        .first<{ status: string; commission_cents: number }>();

      expect(row?.status).toBe('pending');
      expect(row?.commission_cents).toBe(1000);
    });

    it('handles duplicate insertion idempotently', async () => {
      await recordCommissionEntry(db, {
        affiliateId: 'aff_01',
        network: 'amazon_associates',
        externalConversionId: 'conv_dup',
        orderValueCents: 2000,
        commissionCents: 400,
      });

      const second = await recordCommissionEntry(db, {
        affiliateId: 'aff_01',
        network: 'amazon_associates',
        externalConversionId: 'conv_dup',
        orderValueCents: 2000,
        commissionCents: 400,
      });

      expect(second.success).toBe(true);
      expect(second.duplicate).toBe(true);
    });
  });

  describe('recordClawbackAdjustment', () => {
    it('appends negative adjustment row leaving original row untouched', async () => {
      await recordCommissionEntry(db, {
        affiliateId: 'aff_bob',
        network: 'clickbank',
        externalConversionId: 'cb_orig_1',
        orderValueCents: 10000,
        commissionCents: 2500,
      });

      const adjustment = await recordClawbackAdjustment(db, 'cb_orig_1', 2500);
      expect(adjustment.success).toBe(true);
      expect(adjustment.amountCents).toBe(-2500);
      expect(adjustment.status).toBe('clawback');

      // Assert original row remains intact
      const original = await db
        .prepare('SELECT * FROM commission_ledger WHERE external_conversion_id = ?')
        .bind('cb_orig_1')
        .first<{ status: string; commission_cents: number }>();

      expect(original?.status).toBe('pending');
      expect(original?.commission_cents).toBe(2500);

      // Assert clawback row exists with parent_id linked
      const clawRow = await db
        .prepare('SELECT * FROM commission_ledger WHERE id = ?')
        .bind(adjustment.adjustmentId!)
        .first<{ parent_id: string; commission_cents: number; status: string }>();

      expect(clawRow?.commission_cents).toBe(-2500);
      expect(clawRow?.status).toBe('clawback');
      expect(clawRow?.parent_id).toBe('com_cb_orig_1');
    });

    it('supports multiple partial refunds on the same conversion without index collisions', async () => {
      await recordCommissionEntry(db, {
        affiliateId: 'aff_multi',
        network: 'accesstrade',
        externalConversionId: 'at_conv_multi',
        orderValueCents: 20000,
        commissionCents: 5000,
      });

      const claw1 = await recordClawbackAdjustment(db, 'at_conv_multi', 1000);
      const claw2 = await recordClawbackAdjustment(db, 'at_conv_multi', 1500);

      expect(claw1.success).toBe(true);
      expect(claw2.success).toBe(true);

      const netBalance = await getNetAffiliateBalance(db, 'aff_multi');
      expect(netBalance).toBe(2500); // 5000 - 1000 - 1500 = 2500
    });

    it('returns CONVERSION_NOT_FOUND when parent does not exist', async () => {
      const res = await recordClawbackAdjustment(db, 'non_existent_conv', 500);
      expect(res.success).toBe(false);
      expect(res.error).toBe('CONVERSION_NOT_FOUND');
    });
  });

  describe('flipPendingToPayable', () => {
    it('promotes rows on exact millisecond boundary', async () => {
      const payableAt = 5000;

      await recordCommissionEntry(db, {
        affiliateId: 'aff_test',
        network: 'awin',
        externalConversionId: 'awin_time_1',
        orderValueCents: 1000,
        commissionCents: 200,
        payableAt,
      });

      // 1 ms before: no promotion
      const promotedPrior = await flipPendingToPayable(db, payableAt - 1);
      expect(promotedPrior).toBe(0);

      // Exact millisecond: promoted
      const promotedExact = await flipPendingToPayable(db, payableAt);
      expect(promotedExact).toBe(1);

      const row = await db
        .prepare('SELECT status FROM commission_ledger WHERE external_conversion_id = ?')
        .bind('awin_time_1')
        .first<{ status: string }>();

      expect(row?.status).toBe('payable');
    });
  });

  describe('getNetAffiliateBalance and getAffiliateBalanceBreakdown', () => {
    it('correctly aggregates positive credits and negative adjustments', async () => {
      await recordCommissionEntry(db, {
        affiliateId: 'aff_breakdown',
        network: 'tiktok_shop',
        externalConversionId: 'conv_b1',
        orderValueCents: 10000,
        commissionCents: 3000,
      });

      await recordClawbackAdjustment(db, 'conv_b1', 1000);

      const net = await getNetAffiliateBalance(db, 'aff_breakdown');
      expect(net).toBe(2000);

      const breakdown = await getAffiliateBalanceBreakdown(db, 'aff_breakdown');
      expect(breakdown.totalCommissionsCents).toBe(3000);
      expect(breakdown.totalClawbacksCents).toBe(1000);
      expect(breakdown.netCents).toBe(2000);
      expect(breakdown.pendingCents).toBe(3000);
    });

    it('handles negative net balance when refunds exceed earnings without crashing', async () => {
      await recordCommissionEntry(db, {
        affiliateId: 'aff_deficit',
        network: 'amazon_associates',
        externalConversionId: 'conv_def',
        orderValueCents: 1000,
        commissionCents: 200,
      });

      // Clawback larger than original (e.g. chargeback fee adjustment)
      await recordClawbackAdjustment(db, 'conv_def', 500);

      const net = await getNetAffiliateBalance(db, 'aff_deficit');
      expect(net).toBe(-300);
    });
  });
});
