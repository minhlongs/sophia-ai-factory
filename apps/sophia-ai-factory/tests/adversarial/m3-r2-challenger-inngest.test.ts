/**
 * Milestone M3 Round 2 Empirical Challenger Suite
 * Focus: Inngest workflow registration, cron triggers, payout batcher schema fallback,
 * and reconciliation status CHECK constraint compliance.
 *
 * @module tests/adversarial/m3-r2-challenger-inngest.test
 */

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

// Use vi.hoisted so variables are available inside the hoisted vi.mock factory
const state = vi.hoisted(() => ({
  capturedFunctions: [] as any[],
  capturedClient: null as any,
}));

vi.mock('inngest/next', () => ({
  serve: (config: { client: any; functions: any[] }) => {
    state.capturedFunctions = config.functions;
    state.capturedClient = config.client;
    return {
      GET: vi.fn(),
      POST: vi.fn(),
      PUT: vi.fn(),
    };
  },
}));

// Import route handler to trigger serve() evaluation
import * as inngestRoute from '@/app/api/inngest/route';

import {
  affiliateHoldPromoterCron,
  financialReconciliationCron,
  runHoldPromotionJob,
  reconcileDailyFinancials,
} from '@/forest/jobs';

import { processPayoutBatch } from '@/forest/jobs/payout-batcher';
import * as functionsIndex from '@/forest/inngest/functions/index';

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

function createMockD1(db: InstanceType<typeof DatabaseSync>): D1Database {
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

describe('M3 Round 2 Challenger: Inngest Route Discovery & Trigger Integrity', () => {
  it('exports GET, POST, and PUT HTTP route handlers from api/inngest/route.ts', () => {
    expect(inngestRoute.GET).toBeDefined();
    expect(inngestRoute.POST).toBeDefined();
    expect(inngestRoute.PUT).toBeDefined();
    expect(typeof inngestRoute.GET).toBe('function');
    expect(typeof inngestRoute.POST).toBe('function');
    expect(typeof inngestRoute.PUT).toBe('function');
  });

  it('registers affiliateHoldPromoterCron and financialReconciliationCron in Inngest Cloud serve()', () => {
    expect(state.capturedFunctions).toBeDefined();
    expect(state.capturedFunctions.length).toBeGreaterThan(0);

    const holdCron = state.capturedFunctions.find(
      (fn: any) => fn?.opts?.id === 'affiliate-hold-promoter-daily',
    );
    expect(holdCron).toBeDefined();
    expect(holdCron?.opts?.name).toBe('Affiliate 14-Day Hold Promoter — Daily');

    const reconCron = state.capturedFunctions.find(
      (fn: any) => fn?.opts?.id === 'financial-reconciliation-daily',
    );
    expect(reconCron).toBeDefined();
    expect(reconCron?.opts?.name).toBe('Financial Reconciliation — Daily');
  });

  it('validates cron schedules match architectural specifications', () => {
    // 1. Affiliate Hold Promoter must run daily at 02:00 UTC (0 2 * * *)
    const holdCron = state.capturedFunctions.find(
      (fn: any) => fn?.opts?.id === 'affiliate-hold-promoter-daily',
    );
    expect(holdCron?.opts?.triggers).toEqual([{ cron: '0 2 * * *' }]);

    // 2. Financial Reconciliation must run daily at 04:00 UTC (0 4 * * *)
    const reconCron = state.capturedFunctions.find(
      (fn: any) => fn?.opts?.id === 'financial-reconciliation-daily',
    );
    expect(reconCron?.opts?.triggers).toEqual([{ cron: '0 4 * * *' }]);
  });

  it('verifies barrel export integrity across forest/jobs and forest/inngest/functions', () => {
    // Check forest/jobs exports
    expect(affiliateHoldPromoterCron).toBeDefined();
    expect(financialReconciliationCron).toBeDefined();
    expect(typeof runHoldPromotionJob).toBe('function');
    expect(typeof reconcileDailyFinancials).toBe('function');

    // Check forest/inngest/functions re-exports
    expect(functionsIndex.affiliateHoldPromoterCron).toBeDefined();
    expect(functionsIndex.financialReconciliationCron).toBeDefined();
    expect(functionsIndex.affiliateHoldPromoterCron).toBe(affiliateHoldPromoterCron);
    expect(functionsIndex.financialReconciliationCron).toBe(financialReconciliationCron);
  });

  it('verifies programmatic execution of hold promotion runner without Inngest runtime', async () => {
    const rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE commission_ledger (
        id TEXT PRIMARY KEY,
        affiliate_id TEXT NOT NULL,
        network TEXT NOT NULL,
        external_conversion_id TEXT NOT NULL,
        commission_cents INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        hold_days INTEGER NOT NULL DEFAULT 14,
        attributed_at INTEGER NOT NULL,
        payable_at INTEGER NOT NULL,
        payout_batch_id TEXT,
        created_at INTEGER NOT NULL DEFAULT 0,
        UNIQUE(network, external_conversion_id)
      );
    `);

    const now = 1700000000000;
    const pastAttributed = now - 15 * 86400000;
    const pastPayable = now - 1000;
    const futurePayable = now + 14 * 86400000;

    rawDb.prepare(`
      INSERT INTO commission_ledger (
        id, affiliate_id, network, external_conversion_id, commission_cents,
        status, hold_days, attributed_at, payable_at
      ) VALUES
        ('c_mature', 'aff_1', 'tiktok_shop', 'conv_1', 5000, 'pending', 14, ?, ?),
        ('c_young', 'aff_2', 'amazon', 'conv_2', 3000, 'pending', 14, ?, ?)
    `).run(pastAttributed, pastPayable, now, futurePayable);

    const d1 = createMockD1(rawDb);
    const result = await runHoldPromotionJob(d1, now);

    expect(result.promotedCount).toBe(1);
    expect(result.promotedAtMs).toBe(now);

    const rowMature = rawDb.prepare('SELECT status FROM commission_ledger WHERE id = ?').get('c_mature') as { status: string };
    const rowYoung = rawDb.prepare('SELECT status FROM commission_ledger WHERE id = ?').get('c_young') as { status: string };
    expect(rowMature.status).toBe('payable');
    expect(rowYoung.status).toBe('pending');
  });
});

describe('M3 Round 2 Challenger: Payout Batcher Fallback & Schema Integrity', () => {
  it('successfully catches missing total_amount_cents and inserts into legacy total_cents column', async () => {
    const rawDb = new DatabaseSync(':memory:');

    rawDb.exec(`
      CREATE TABLE commission_ledger (
        id TEXT PRIMARY KEY,
        affiliate_id TEXT NOT NULL,
        network TEXT NOT NULL,
        external_conversion_id TEXT NOT NULL,
        commission_cents INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'payable',
        hold_days INTEGER NOT NULL DEFAULT 14,
        attributed_at INTEGER NOT NULL,
        payable_at INTEGER NOT NULL,
        payout_batch_id TEXT,
        parent_id TEXT,
        created_at INTEGER NOT NULL DEFAULT 0,
        UNIQUE(network, external_conversion_id)
      );

      CREATE TABLE payout_batches (
        id TEXT PRIMARY KEY,
        rail TEXT NOT NULL,
        total_cents INTEGER NOT NULL DEFAULT 0,
        recipient_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        tx_hash TEXT,
        created_at INTEGER NOT NULL DEFAULT 0,
        confirmed_at INTEGER
      );
    `);

    // Verify the schema strictly lacks total_amount_cents
    const tableInfo = rawDb.prepare("PRAGMA table_info(payout_batches)").all() as Array<{ name: string }>;
    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('total_cents');
    expect(columnNames).not.toContain('total_amount_cents');

    // Seed payable rows
    rawDb.prepare(`
      INSERT INTO commission_ledger (
        id, affiliate_id, network, external_conversion_id, commission_cents,
        status, hold_days, attributed_at, payable_at
      ) VALUES
        ('c_legacy_1', 'aff_alice', 'tiktok_shop', 'conv_leg_1', 12500, 'payable', 14, 1000, 2000),
        ('c_legacy_2', 'aff_bob', 'amazon_associates', 'conv_leg_2', 17500, 'payable', 14, 1000, 2000)
    `).run();

    const d1 = createMockD1(rawDb);
    const result = await processPayoutBatch(d1, 'nowpayments_usdt');

    expect(result.success).toBe(true);
    expect(result.totalAmountCents).toBe(30000);
    expect(result.recipientCount).toBe(2);
    expect(result.claimedRowIds).toEqual(['c_legacy_1', 'c_legacy_2']);

    // Query payout_batches directly to verify fallback insertion succeeded
    const batchRow = rawDb
      .prepare('SELECT id, rail, total_cents, recipient_count, status FROM payout_batches WHERE id = ?')
      .get(result.batchId) as {
        id: string;
        rail: string;
        total_cents: number;
        recipient_count: number;
        status: string;
      } | undefined;

    expect(batchRow).toBeDefined();
    expect(batchRow?.id).toBe(result.batchId);
    expect(batchRow?.rail).toBe('nowpayments_usdt');
    expect(batchRow?.total_cents).toBe(30000);
    expect(batchRow?.recipient_count).toBe(2);
    expect(batchRow?.status).toBe('processing');

    // Verify commission_ledger rows were transitioned to 'paying'
    const rows = rawDb
      .prepare('SELECT id, status, payout_batch_id FROM commission_ledger WHERE id IN (?, ?)')
      .all('c_legacy_1', 'c_legacy_2') as Array<{ id: string; status: string; payout_batch_id: string }>;

    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.status).toBe('paying');
      expect(r.payout_batch_id).toBe(result.batchId);
    }
  });

  it('verifies modern schema (total_amount_cents) path operates without triggering fallback', async () => {
    const rawDb = new DatabaseSync(':memory:');

    rawDb.exec(`
      CREATE TABLE commission_ledger (
        id TEXT PRIMARY KEY,
        affiliate_id TEXT NOT NULL,
        network TEXT NOT NULL,
        external_conversion_id TEXT NOT NULL,
        commission_cents INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'payable',
        hold_days INTEGER NOT NULL DEFAULT 14,
        attributed_at INTEGER NOT NULL,
        payable_at INTEGER NOT NULL,
        payout_batch_id TEXT,
        parent_id TEXT,
        created_at INTEGER NOT NULL DEFAULT 0,
        UNIQUE(network, external_conversion_id)
      );

      CREATE TABLE payout_batches (
        id TEXT PRIMARY KEY,
        rail TEXT NOT NULL,
        total_amount_cents INTEGER NOT NULL DEFAULT 0,
        recipient_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        tx_hash TEXT,
        created_at INTEGER NOT NULL DEFAULT 0,
        confirmed_at INTEGER
      );
    `);

    rawDb.prepare(`
      INSERT INTO commission_ledger (
        id, affiliate_id, network, external_conversion_id, commission_cents,
        status, hold_days, attributed_at, payable_at
      ) VALUES
        ('c_mod_1', 'aff_carol', 'clickbank', 'conv_mod_1', 8000, 'payable', 14, 1000, 2000)
    `).run();

    const d1 = createMockD1(rawDb);
    const result = await processPayoutBatch(d1, 'nowpayments_usdt');

    expect(result.success).toBe(true);
    expect(result.totalAmountCents).toBe(8000);

    const batchRow = rawDb
      .prepare('SELECT id, rail, total_amount_cents, status FROM payout_batches WHERE id = ?')
      .get(result.batchId) as { id: string; rail: string; total_amount_cents: number; status: string } | undefined;

    expect(batchRow).toBeDefined();
    expect(batchRow?.total_amount_cents).toBe(8000);
    expect(batchRow?.status).toBe('processing');
  });

  it('survives an extreme schema variation (neither total_amount_cents nor total_cents) without crashing', async () => {
    const rawDb = new DatabaseSync(':memory:');

    rawDb.exec(`
      CREATE TABLE commission_ledger (
        id TEXT PRIMARY KEY,
        affiliate_id TEXT NOT NULL,
        network TEXT NOT NULL,
        external_conversion_id TEXT NOT NULL,
        commission_cents INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'payable',
        hold_days INTEGER NOT NULL DEFAULT 14,
        attributed_at INTEGER NOT NULL,
        payable_at INTEGER NOT NULL,
        payout_batch_id TEXT,
        created_at INTEGER NOT NULL DEFAULT 0
      );

      -- Malformed schema without any amount column
      CREATE TABLE payout_batches (
        id TEXT PRIMARY KEY,
        rail TEXT NOT NULL,
        recipient_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending'
      );
    `);

    rawDb.prepare(`
      INSERT INTO commission_ledger (
        id, affiliate_id, network, external_conversion_id, commission_cents, status, attributed_at, payable_at
      ) VALUES ('c_err_1', 'aff_x', 'awin', 'conv_x', 5000, 'payable', 1000, 2000)
    `).run();

    const d1 = createMockD1(rawDb);

    // Should NOT throw an unhandled exception despite both inserts failing
    const result = await processPayoutBatch(d1, 'nowpayments_usdt');
    expect(result.success).toBe(true);
    expect(result.totalAmountCents).toBe(5000);
  });

  it('verifies strict CHECK constraint compliance for confirmed and reconciliation_failed statuses', async () => {
    const rawDb = new DatabaseSync(':memory:');

    // Replicate exact Migration 0275 table definition
    rawDb.exec(`
      CREATE TABLE payout_batches (
        id TEXT PRIMARY KEY,
        rail TEXT NOT NULL,
        total_amount_cents INTEGER NOT NULL DEFAULT 0,
        recipient_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'confirmed', 'reconciliation_failed')),
        tx_hash TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        confirmed_at INTEGER
      );

      CREATE TABLE commission_ledger (
        id TEXT PRIMARY KEY,
        affiliate_id TEXT NOT NULL,
        commission_cents INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'paying',
        payout_batch_id TEXT
      );
    `);

    const d1 = createMockD1(rawDb);

    // 1. Batch reconciled -> status updates to 'confirmed'
    rawDb.prepare(`
      INSERT INTO payout_batches (id, rail, total_amount_cents, status)
      VALUES ('batch_ok', 'nowpayments_usdt', 10000, 'processing');
      INSERT INTO commission_ledger (id, affiliate_id, commission_cents, status, payout_batch_id)
      VALUES ('c_ok_1', 'aff_1', 10000, 'paying', 'batch_ok');
    `).run();

    const okResult = await reconcileDailyFinancials(d1, 'batch_ok', 10000);
    expect(okResult.isReconciled).toBe(true);
    expect(okResult.alertRequired).toBe(false);

    const okRow = rawDb.prepare('SELECT status, confirmed_at FROM payout_batches WHERE id = ?').get('batch_ok') as {
      status: string;
      confirmed_at: number;
    };
    expect(okRow.status).toBe('confirmed');
    expect(okRow.confirmed_at).toBeGreaterThan(0);

    // 2. Batch unreconciled (discrepancy > $1.00) -> status updates to 'reconciliation_failed'
    rawDb.prepare(`
      INSERT INTO payout_batches (id, rail, total_amount_cents, status)
      VALUES ('batch_fail', 'nowpayments_usdt', 20000, 'processing');
      INSERT INTO commission_ledger (id, affiliate_id, commission_cents, status, payout_batch_id)
      VALUES ('c_fail_1', 'aff_2', 20000, 'paying', 'batch_fail');
    `).run();

    const failResult = await reconcileDailyFinancials(d1, 'batch_fail', 15000);
    expect(failResult.isReconciled).toBe(false);
    expect(failResult.alertRequired).toBe(true);

    const failRow = rawDb.prepare('SELECT status FROM payout_batches WHERE id = ?').get('batch_fail') as { status: string };
    expect(failRow.status).toBe('reconciliation_failed');

    // 3. Any unregistered status must be rejected by SQLite CHECK constraint
    expect(() => {
      rawDb.prepare("UPDATE payout_batches SET status = 'bogus_status' WHERE id = 'batch_ok'").run();
    }).toThrow(/CHECK constraint failed/);
  });
});
