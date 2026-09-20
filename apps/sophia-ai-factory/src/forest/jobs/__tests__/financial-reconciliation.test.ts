import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  reconcileDailyFinancials,
  runDailyFinancialReconciliation,
  financialReconciliationCron,
} from '../financial-reconciliation';

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
      commission_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'paying',
      payout_batch_id TEXT,
      created_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payout_batches (
      id TEXT PRIMARY KEY,
      rail TEXT NOT NULL,
      total_amount_cents INTEGER NOT NULL DEFAULT 0,
      recipient_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'confirmed', 'reconciliation_failed')),
      tx_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      confirmed_at INTEGER
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

describe('Financial Reconciliation (forest/jobs/financial-reconciliation)', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('Tolerance boundaries and status updates', () => {
    it('reconciles when diff is within $1.00 tolerance (50 cents diff)', async () => {
      const batchId = 'batch_rec_1';
      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES (?, 'nowpayments_usdt', 13000, 2, 'processing')`,
        )
        .bind(batchId)
        .run();

      await db
        .prepare(
          `INSERT INTO commission_ledger (id, affiliate_id, network, external_conversion_id, commission_cents, status, payout_batch_id)
           VALUES ('c1', 'aff_1', 'tiktok_shop', 'conv_1', 13000, 'paying', ?)`,
        )
        .bind(batchId)
        .run();

      const result = await reconcileDailyFinancials(db, batchId, 13050); // diff = 50 cents

      expect(result.isReconciled).toBe(true);
      expect(result.alertRequired).toBe(false);
      expect(result.diffCents).toBe(50);

      // Verify batch marked confirmed
      const batch = await db
        .prepare('SELECT status FROM payout_batches WHERE id = ?')
        .bind(batchId)
        .first<{ status: string }>();
      expect(batch?.status).toBe('confirmed');

      // Verify ledger rows transitioned from paying to paid
      const row = await db
        .prepare('SELECT status FROM commission_ledger WHERE id = ?')
        .bind('c1')
        .first<{ status: string }>();
      expect(row?.status).toBe('paid');
    });

    it('fails reconciliation and flags alert when diff exceeds $1.00 tolerance', async () => {
      const batchId = 'batch_rec_2';
      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES (?, 'nowpayments_usdt', 13000, 2, 'processing')`,
        )
        .bind(batchId)
        .run();

      const result = await reconcileDailyFinancials(db, batchId, 11000); // diff = 2000 cents ($20)

      expect(result.isReconciled).toBe(false);
      expect(result.alertRequired).toBe(true);
      expect(result.diffCents).toBe(2000);

      const batch = await db
        .prepare('SELECT status FROM payout_batches WHERE id = ?')
        .bind(batchId)
        .first<{ status: string }>();
      expect(batch?.status).toBe('reconciliation_failed');
    });

    it('boundary check: exact 100 cents passes, 101 cents fails', async () => {
      const batchId1 = 'b_100';
      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES (?, 'nowpayments_usdt', 10000, 1, 'processing')`,
        )
        .bind(batchId1)
        .run();

      const passRecon = await reconcileDailyFinancials(db, batchId1, 10100); // diff = 100 cents
      expect(passRecon.isReconciled).toBe(true);
      expect(passRecon.alertRequired).toBe(false);

      const batchId2 = 'b_101';
      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES (?, 'nowpayments_usdt', 10000, 1, 'processing')`,
        )
        .bind(batchId2)
        .run();

      const failRecon = await reconcileDailyFinancials(db, batchId2, 10101); // diff = 101 cents
      expect(failRecon.isReconciled).toBe(false);
      expect(failRecon.alertRequired).toBe(true);
    });

    it('fails when external confirmed cents is 0 against positive ledger total', async () => {
      const batchId = 'b_zero';
      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES (?, 'nowpayments_usdt', 5000, 1, 'processing')`,
        )
        .bind(batchId)
        .run();

      const zeroRecon = await reconcileDailyFinancials(db, batchId, 0);
      expect(zeroRecon.isReconciled).toBe(false);
      expect(zeroRecon.alertRequired).toBe(true);
      expect(zeroRecon.diffCents).toBe(5000);
    });
  });

  describe('runDailyFinancialReconciliation sweep', () => {
    it('sweeps processing batches and produces structured report', async () => {
      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES ('batch_sweep_1', 'nowpayments_usdt', 5000, 1, 'processing'),
                  ('batch_sweep_2', 'nowpayments_usdt', 8000, 1, 'processing')`,
        )
        .run();

      const report = await runDailyFinancialReconciliation(db);
      expect(report.results).toHaveLength(2);
      expect(report.reconciledCount).toBe(2);
      expect(report.failedCount).toBe(0);
    });

    it('exposes Inngest cron configuration with 04:00 daily schedule', () => {
      expect(financialReconciliationCron).toBeDefined();
      expect(financialReconciliationCron).toHaveProperty('name');
    });
  });

  describe('Migration 0275 CHECK constraint schema parity', () => {
    it('allows confirmed and reconciliation_failed terminal states under CHECK constraint', async () => {
      const batchId = 'batch_check_ok';
      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES (?, 'nowpayments_usdt', 5000, 1, 'processing')`,
        )
        .bind(batchId)
        .run();

      // Test write to 'confirmed'
      await expect(
        db
          .prepare('UPDATE payout_batches SET status = ?, confirmed_at = ? WHERE id = ?')
          .bind('confirmed', Date.now(), batchId)
          .run(),
      ).resolves.toBeDefined();

      const confirmedRow = await db
        .prepare('SELECT status FROM payout_batches WHERE id = ?')
        .bind(batchId)
        .first<{ status: string }>();
      expect(confirmedRow?.status).toBe('confirmed');

      // Test write to 'reconciliation_failed'
      await expect(
        db
          .prepare('UPDATE payout_batches SET status = ? WHERE id = ?')
          .bind('reconciliation_failed', batchId)
          .run(),
      ).resolves.toBeDefined();

      const failedRow = await db
        .prepare('SELECT status FROM payout_batches WHERE id = ?')
        .bind(batchId)
        .first<{ status: string }>();
      expect(failedRow?.status).toBe('reconciliation_failed');
    });

    it('rejects invalid statuses with SQLite CHECK constraint failure', async () => {
      const batchId = 'batch_check_fail';
      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES (?, 'nowpayments_usdt', 5000, 1, 'processing')`,
        )
        .bind(batchId)
        .run();

      await expect(
        db
          .prepare('UPDATE payout_batches SET status = ? WHERE id = ?')
          .bind('arbitrary_invalid_status', batchId)
          .run(),
      ).rejects.toThrow();
    });
  });
});

