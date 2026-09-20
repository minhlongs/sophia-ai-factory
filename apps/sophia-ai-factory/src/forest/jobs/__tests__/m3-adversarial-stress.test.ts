/**
 * Empirical Adversarial Stress Test Harness — Milestone M3
 *
 * Multi-Network Affiliate Commission & Automated USDT Payouts Engine
 *
 * Challenge Responsibilities:
 * 1. Dual-Entry Ledger & Clawback Adjustments:
 *    - Multiple concurrent partial clawbacks against same parent conversion (verify zero SQLite unique constraint errors).
 *    - Clawbacks exceeding original commission (assert proper balance deficit / negative net calculations).
 *    - Hold promotion boundary: exactly payable_at - 1 vs payable_at.
 * 2. NOWPayments Batch Processor OCC CAS:
 *    - Multiple concurrent batch processors competing for same payable rows (verify zero double-claiming; rows claimed by at most one batch).
 *    - Payout rail failure simulation (verify 100% of claimed rows roll back to 'payable').
 *    - Token-bucket rate limiter under burst calls (verify strict <= 5 req/s).
 * 3. Financial Reconciliation:
 *    - Exact $1.00 (100 cents) difference -> passes/confirmed.
 *    - $1.01 (101 cents) difference -> fails/triggers alert.
 *
 * @module forest/jobs/__tests__/m3-adversarial-stress.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import {
  recordCommissionEntry,
  recordClawbackAdjustment,
  flipPendingToPayable,
  getNetAffiliateBalance,
  getAffiliateBalanceBreakdown,
  calculatePayableAt,
} from '@/tree/affiliate/commission-ledger';
import { processPayoutBatch } from '@/forest/jobs/payout-batcher';
import {
  reconcileDailyFinancials,
  runDailyFinancialReconciliation,
} from '@/forest/jobs/financial-reconciliation';
import { TokenBucket } from '@/tree/payouts/token-bucket';
import { evaluateReconciliation } from '@/tree/payouts/reconciliation-math';

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

function createM3TestDb() {
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
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'payable', 'paying', 'paid', 'clawback', 'clawed_back')),
      hold_days INTEGER NOT NULL DEFAULT 14,
      attributed_at INTEGER NOT NULL,
      payable_at INTEGER NOT NULL,
      payout_batch_id TEXT,
      parent_id TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(network, external_conversion_id)
    );

    CREATE TABLE IF NOT EXISTS payout_batches (
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

describe('M3 Empirical Adversarial Stress Test Suite', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createM3TestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DUAL-ENTRY LEDGER & CLAWBACK ADJUSTMENTS STRESS CHALLENGES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Dual-Entry Ledger & Clawback Adjustments', () => {
    it('1.1: Survives 30 concurrent partial clawbacks on the same conversion with zero UNIQUE constraint collisions', async () => {
      // Seed a parent conversion with 100,000 cents ($1,000.00) commission
      const parentConvId = 'conv_burst_parent_01';
      const affiliateId = 'aff_power_seller';
      await recordCommissionEntry(db, {
        affiliateId,
        network: 'tiktok_shop',
        externalConversionId: parentConvId,
        orderValueCents: 500000,
        commissionCents: 100000,
        attributedAt: 1000,
        payableAt: 2000,
      });

      // Spawn 30 concurrent partial clawbacks of 1,000 cents each
      const CONCURRENT_CLAWBACKS = 30;
      const clawbackAmount = 1000;
      const promises = Array.from({ length: CONCURRENT_CLAWBACKS }, (_, i) =>
        recordClawbackAdjustment(db, parentConvId, clawbackAmount, 2500 + i, `Partial refund installment #${i + 1}`),
      );

      const results = await Promise.all(promises);

      // Verify all 30 succeeded without throwing UNIQUE constraint violation
      expect(results).toHaveLength(CONCURRENT_CLAWBACKS);
      for (const res of results) {
        expect(res.success).toBe(true);
        expect(res.amountCents).toBe(-clawbackAmount);
        expect(res.status).toBe('clawback');
        expect(res.adjustmentId).toBeDefined();
        expect(res.error).toBeUndefined();
      }

      // Assert all adjustment rows exist in the database with parent_id set to parent conversion
      const allClawbacks = await db
        .prepare("SELECT id, external_conversion_id, commission_cents, parent_id, status FROM commission_ledger WHERE status = 'clawback'")
        .all<{ id: string; external_conversion_id: string; commission_cents: number; parent_id: string; status: string }>();

      expect(allClawbacks.results).toHaveLength(CONCURRENT_CLAWBACKS);

      // Assert each external_conversion_id is distinct (no index collisions)
      const externalIds = new Set(allClawbacks.results.map((r) => r.external_conversion_id));
      expect(externalIds.size).toBe(CONCURRENT_CLAWBACKS);

      // Assert net balance reflects parent commission minus 30 * 1,000 = 70,000 cents
      const netBalance = await getNetAffiliateBalance(db, affiliateId);
      expect(netBalance).toBe(100000 - CONCURRENT_CLAWBACKS * clawbackAmount); // 70,000 cents ($700.00)

      // Assert original parent row was NEVER mutated (Double-entry immutability invariant)
      const parentRow = await db
        .prepare('SELECT commission_cents, status FROM commission_ledger WHERE external_conversion_id = ?')
        .bind(parentConvId)
        .first<{ commission_cents: number; status: string }>();

      expect(parentRow?.commission_cents).toBe(100000);
      expect(parentRow?.status).toBe('pending');
    });

    it('1.2: Handles extreme clawbacks exceeding original commission (asserts proper balance deficit / negative net calculations)', async () => {
      const affiliateId = 'aff_deficit_case';
      const parentConvId = 'conv_chargeback_heavy';

      // Original commission: 5,000 cents ($50.00)
      await recordCommissionEntry(db, {
        affiliateId,
        network: 'amazon_associates',
        externalConversionId: parentConvId,
        orderValueCents: 20000,
        commissionCents: 5000,
      });

      // Clawback includes refund + bank chargeback penalties = 12,000 cents ($120.00)
      const clawbackRes = await recordClawbackAdjustment(db, parentConvId, 12000, 3000, 'Chargeback with punitive dispute fee');

      expect(clawbackRes.success).toBe(true);
      expect(clawbackRes.amountCents).toBe(-12000);

      // Net balance must accurately reflect a negative deficit of -7,000 cents (-$70.00)
      const net = await getNetAffiliateBalance(db, affiliateId);
      expect(net).toBe(-7000);

      // Verify itemized breakdown matches ledger reality
      const breakdown = await getAffiliateBalanceBreakdown(db, affiliateId);
      expect(breakdown.totalCommissionsCents).toBe(5000);
      expect(breakdown.totalClawbacksCents).toBe(12000);
      expect(breakdown.netCents).toBe(-7000);
      expect(breakdown.pendingCents).toBe(5000);
    });

    it('1.3: Verifies hold promotion millisecond boundary: exactly payable_at - 1 vs payable_at', async () => {
      const payableAt = 1_700_000_000_000;

      await recordCommissionEntry(db, {
        affiliateId: 'aff_boundary',
        network: 'awin',
        externalConversionId: 'conv_exact_boundary',
        orderValueCents: 10000,
        commissionCents: 2000,
        payableAt,
      });

      // Boundary - 1 ms: exactly 0 rows promoted
      const promotedBefore = await flipPendingToPayable(db, payableAt - 1);
      expect(promotedBefore).toBe(0);

      let row = await db
        .prepare('SELECT status FROM commission_ledger WHERE external_conversion_id = ?')
        .bind('conv_exact_boundary')
        .first<{ status: string }>();
      expect(row?.status).toBe('pending');

      // Boundary exact: exactly 1 row promoted
      const promotedExact = await flipPendingToPayable(db, payableAt);
      expect(promotedExact).toBe(1);

      row = await db
        .prepare('SELECT status FROM commission_ledger WHERE external_conversion_id = ?')
        .bind('conv_exact_boundary')
        .first<{ status: string }>();
      expect(row?.status).toBe('payable');

      // Boundary + 1 ms: row is already payable, flipPendingToPayable returns 0 additional changes
      const promotedAfter = await flipPendingToPayable(db, payableAt + 1);
      expect(promotedAfter).toBe(0);
    });

    it('1.4: Staggered batch hold promotion promotes only eligible entries at evaluated timestamp', async () => {
      const baseTime = 10_000;
      // Seed 3 rows: matured (baseTime - 100), exactly now (baseTime), future (baseTime + 100)
      for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * 100; // -100, 0, +100
        await recordCommissionEntry(db, {
          affiliateId: `aff_${i}`,
          network: 'clickbank',
          externalConversionId: `conv_stagger_${i}`,
          orderValueCents: 5000,
          commissionCents: 1000,
          payableAt: baseTime + offset,
        });
      }

      // Promote at baseTime: should promote exactly 2 rows (offset -100 and offset 0)
      const promotedCount = await flipPendingToPayable(db, baseTime);
      expect(promotedCount).toBe(2);

      // Verify the future row (offset +100) remains pending
      const futureRow = await db
        .prepare('SELECT status FROM commission_ledger WHERE external_conversion_id = ?')
        .bind('conv_stagger_2')
        .first<{ status: string }>();
      expect(futureRow?.status).toBe('pending');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. NOWPAYMENTS BATCH PROCESSOR OCC CAS & RESILIENCE CHALLENGES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. NOWPayments Batch Processor OCC CAS & Rail Resilience', () => {
    it('2.1: Ten concurrent batch processors competing for the same 20 payable rows yield zero double-claiming', async () => {
      // Seed 20 payable rows (each 500 cents = $5.00, well above the $1.00 threshold)
      const TOTAL_ROWS = 20;
      const ROW_AMOUNT_CENTS = 500;
      for (let i = 0; i < TOTAL_ROWS; i++) {
        await db
          .prepare(
            `INSERT INTO commission_ledger (
              id, affiliate_id, network, external_conversion_id, commission_cents,
              status, hold_days, attributed_at, payable_at
            ) VALUES (?, ?, 'tiktok_shop', ?, ?, 'payable', 14, 1000, 2000)`,
          )
          .bind(`row_${i}`, `aff_${i % 5}`, `ext_race_${i}`, ROW_AMOUNT_CENTS)
          .run();
      }

      // 10 concurrent batch runners competing simultaneously
      const NUM_PROCESSORS = 10;
      const baseMs = 5000;
      const batchPromises = Array.from({ length: NUM_PROCESSORS }, (_, pIdx) =>
        processPayoutBatch(db, 'nowpayments_usdt', baseMs + pIdx * 10),
      );

      const batchResults = await Promise.all(batchPromises);

      // Collect all claimed row IDs across all 10 batch runs
      const allClaimedIds: string[] = [];
      let totalClaimedAmount = 0;

      for (const res of batchResults) {
        expect(res.success).toBe(true);
        allClaimedIds.push(...res.claimedRowIds);
        totalClaimedAmount += res.totalAmountCents;
      }

      // CRITICAL ASSERTION: Zero double-claiming
      // Total claimed rows across all batches must equal exactly the unique claimed row IDs
      const uniqueClaimedIds = new Set(allClaimedIds);
      expect(allClaimedIds.length).toBe(uniqueClaimedIds.size);

      // All 20 rows must have been claimed exactly once across all competing workers
      expect(uniqueClaimedIds.size).toBe(TOTAL_ROWS);
      expect(totalClaimedAmount).toBe(TOTAL_ROWS * ROW_AMOUNT_CENTS); // 10,000 cents

      // Verify in SQLite: each row has status = 'paying' and payout_batch_id IS NOT NULL
      const claimedRowsInDb = await db
        .prepare("SELECT id, status, payout_batch_id FROM commission_ledger WHERE status = 'paying'")
        .all<{ id: string; status: string; payout_batch_id: string }>();

      expect(claimedRowsInDb.results).toHaveLength(TOTAL_ROWS);

      // Verify that every claimed row belongs to exactly one of the generated batch IDs
      const generatedBatchIds = new Set(batchResults.map((r) => r.batchId));
      for (const row of claimedRowsInDb.results) {
        expect(generatedBatchIds.has(row.payout_batch_id)).toBe(true);
      }
    });

    it('2.2: Payout rail failure rolls back 100% of claimed rows from paying back to payable', async () => {
      // Seed 5 payable rows
      for (let i = 0; i < 5; i++) {
        await db
          .prepare(
            `INSERT INTO commission_ledger (
              id, affiliate_id, network, external_conversion_id, commission_cents,
              status, hold_days, attributed_at, payable_at
            ) VALUES (?, 'aff_failover', 'amazon_associates', ?, 1500, 'payable', 14, 1000, 2000)`,
          )
          .bind(`fail_row_${i}`, `ext_fail_${i}`)
          .run();
      }

      // Simulate NOWPayments rail failure:
      // Configure env to trigger real dispatch path and mock fetch to simulate HTTP 503 Service Unavailable
      const originalEnv = { ...process.env };
      const originalFetch = globalThis.fetch;

      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.NOWPAYMENTS_API_KEY = 'test_secret_key';
      process.env.SIMULATE_PAYOUT_RAIL = 'false';

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'NOWPayments Rail Failure: 503 Service Unavailable',
      });

      const failedBatch = await processPayoutBatch(db, 'nowpayments_usdt', 99000);

      // Batch execution should fail cleanly
      expect(failedBatch.success).toBe(false);
      expect(failedBatch.error).toContain('NOWPayments payout API error (503)');

      // ASSERT 100% ROLLBACK IN DATABASE:
      // All 5 rows must have status = 'payable' and payout_batch_id = NULL
      const rolledBackRows = await db
        .prepare("SELECT id, status, payout_batch_id FROM commission_ledger WHERE id LIKE 'fail_row_%'")
        .all<{ id: string; status: string; payout_batch_id: string | null }>();

      expect(rolledBackRows.results).toHaveLength(5);
      for (const r of rolledBackRows.results) {
        expect(r.status).toBe('payable');
        expect(r.payout_batch_id).toBeNull();
      }

      // Batch record in payout_batches should be marked 'failed'
      const batchRecord = await db
        .prepare('SELECT status FROM payout_batches WHERE id = ?')
        .bind(failedBatch.batchId)
        .first<{ status: string }>();
      expect(batchRecord?.status).toBe('failed');

      // RESTORE RAIL & RE-RUN: Assert rows can be claimed successfully after recovery
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'tx_nowpayments_success_recovered' }),
      });

      const recoveredBatch = await processPayoutBatch(db, 'nowpayments_usdt', 100000);
      expect(recoveredBatch.success).toBe(true);
      expect(recoveredBatch.claimedRowIds).toHaveLength(5);
      expect(recoveredBatch.totalAmountCents).toBe(7500); // 5 * 1500

      // Cleanup env & fetch
      process.env = originalEnv;
      globalThis.fetch = originalFetch;
    });

    it('2.3: Token-bucket rate limiter strictly bounds burst calls to <= 5 req/s sustained rate', async () => {
      const limiter = new TokenBucket({ capacity: 5, refillRatePerSecond: 5 });

      // Immediate capacity check: 5 tokens available
      expect(limiter.getAvailableTokens()).toBe(5);

      // First 5 acquire() calls consume all capacity immediately
      const initialBatch = [1, 2, 3, 4, 5];
      const startT0 = Date.now();
      for (const _ of initialBatch) {
        await limiter.acquire(1);
      }
      const t0Elapsed = Date.now() - startT0;
      // 5 initial tokens must take virtually zero time (< 50ms)
      expect(t0Elapsed).toBeLessThan(100);

      // Remaining tokens must be empty
      expect(limiter.tryAcquire(1)).toBe(false);

      // Fire a subsequent burst of 5 more acquire() calls
      // At 5 req/s refill rate, acquiring 5 new tokens requires ~1,000 ms
      const startBurst = Date.now();
      for (let i = 0; i < 5; i++) {
        await limiter.acquire(1);
      }
      const burstDuration = Date.now() - startBurst;

      // Burst duration must be at least ~800ms (allowing slight timer slack)
      expect(burstDuration).toBeGreaterThanOrEqual(750);

      // Calculate effective rate across the burst: 5 tokens / burstDuration
      const effectiveRate = (5 / burstDuration) * 1000;
      expect(effectiveRate).toBeLessThanOrEqual(6.5); // strictly within boundary of 5 req/s + minor jitter
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. FINANCIAL RECONCILIATION STRESS CHALLENGES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Financial Reconciliation Math & Boundary Enforcement', () => {
    it('3.1: Exactly $1.00 (100 cents) difference passes reconciliation and confirms batch and ledger rows', async () => {
      const batchId = 'batch_recon_exact_100';
      const claimedAmountCents = 25000; // $250.00

      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES (?, 'nowpayments_usdt', ?, 2, 'processing')`,
        )
        .bind(batchId, claimedAmountCents)
        .run();

      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, commission_cents,
            status, hold_days, attributed_at, payable_at, payout_batch_id
          ) VALUES ('c_recon_1', 'aff_recon', 'clickbank', 'conv_r1', ?, 'paying', 14, 1000, 2000, ?)`,
        )
        .bind(claimedAmountCents, batchId)
        .run();

      // Case A: confirmed amount is exactly 100 cents higher ($1.00 over)
      const resA = await reconcileDailyFinancials(db, batchId, claimedAmountCents + 100);
      expect(resA.isReconciled).toBe(true);
      expect(resA.alertRequired).toBe(false);
      expect(resA.diffCents).toBe(100);

      // Assert batch status marked confirmed
      const batchA = await db
        .prepare('SELECT status, confirmed_at FROM payout_batches WHERE id = ?')
        .bind(batchId)
        .first<{ status: string; confirmed_at: number }>();
      expect(batchA?.status).toBe('confirmed');
      expect(batchA?.confirmed_at).toBeGreaterThan(0);

      // Assert ledger rows transitioned from 'paying' to 'paid'
      const rowA = await db
        .prepare("SELECT status FROM commission_ledger WHERE id = 'c_recon_1'")
        .first<{ status: string }>();
      expect(rowA?.status).toBe('paid');

      // Case B: confirmed amount is exactly 100 cents lower ($1.00 under)
      const batchIdUnder = 'batch_recon_under_100';
      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES (?, 'nowpayments_usdt', ?, 1, 'processing')`,
        )
        .bind(batchIdUnder, 10000)
        .run();

      const resB = await reconcileDailyFinancials(db, batchIdUnder, 9900); // diff = 100 cents
      expect(resB.isReconciled).toBe(true);
      expect(resB.alertRequired).toBe(false);
      expect(resB.diffCents).toBe(100);
    });

    it('3.2: $1.01 (101 cents) difference strictly fails reconciliation and triggers alert', async () => {
      const batchId = 'batch_recon_fail_101';
      const claimedAmountCents = 20000; // $200.00

      await db
        .prepare(
          `INSERT INTO payout_batches (id, rail, total_amount_cents, recipient_count, status)
           VALUES (?, 'nowpayments_usdt', ?, 1, 'processing')`,
        )
        .bind(batchId, claimedAmountCents)
        .run();

      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, commission_cents,
            status, hold_days, attributed_at, payable_at, payout_batch_id
          ) VALUES ('c_fail_1', 'aff_recon_2', 'tiktok_shop', 'conv_fail_101', ?, 'paying', 14, 1000, 2000, ?)`,
        )
        .bind(claimedAmountCents, batchId)
        .run();

      // Confirmed amount is 101 cents higher ($1.01 difference)
      const res = await reconcileDailyFinancials(db, batchId, claimedAmountCents + 101);

      expect(res.isReconciled).toBe(false);
      expect(res.alertRequired).toBe(true);
      expect(res.diffCents).toBe(101);

      // Verify batch status is marked 'reconciliation_failed'
      const batch = await db
        .prepare('SELECT status FROM payout_batches WHERE id = ?')
        .bind(batchId)
        .first<{ status: string }>();
      expect(batch?.status).toBe('reconciliation_failed');

      // Verify ledger row does NOT transition to 'paid' (remains 'paying' for audit investigation)
      const row = await db
        .prepare("SELECT status FROM commission_ledger WHERE id = 'c_fail_1'")
        .first<{ status: string }>();
      expect(row?.status).toBe('paying');
    });

    it('3.3: Pure mathematical evaluation invariant for reconciliation threshold', () => {
      // 0 cents diff -> passes
      expect(evaluateReconciliation(10000, 10000)).toEqual({
        diffCents: 0,
        isReconciled: true,
        alertRequired: false,
      });

      // 99 cents diff -> passes
      expect(evaluateReconciliation(10000, 10099)).toEqual({
        diffCents: 99,
        isReconciled: true,
        alertRequired: false,
      });

      // 100 cents diff -> passes
      expect(evaluateReconciliation(10000, 10100)).toEqual({
        diffCents: 100,
        isReconciled: true,
        alertRequired: false,
      });

      // 101 cents diff -> fails
      expect(evaluateReconciliation(10000, 10101)).toEqual({
        diffCents: 101,
        isReconciled: false,
        alertRequired: true,
      });

      // 5,000 cents diff -> fails
      expect(evaluateReconciliation(10000, 15000)).toEqual({
        diffCents: 5000,
        isReconciled: false,
        alertRequired: true,
      });
    });
  });
});
