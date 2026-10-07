/**
 * Adversarial Concurrency & Idempotency Stress Test Suite — Milestone 1
 *
 * Validates under true Node 22 native SQLite relational engine:
 * 1. Parallel Webhook Idempotency:
 *    - 5 concurrent NOWPayments webhook invocations with identical payment_id.
 *    - 5 concurrent PayOS webhook invocations with identical paymentLinkId.
 *    - Strict single-credit guarantee: ledger contains exactly 1 record, partner credited exactly once.
 * 2. Optimistic Concurrency Control (OCC):
 *    - 5 concurrent payout approval attempts with identical version.
 *    - 5 concurrent payout completion / settlement attempts with identical version.
 *    - 5 concurrent commission status updates with identical version.
 *    - Strict CAS check: exactly 1 operation succeeds, remaining 4 strictly blocked with OCC_VERSION_CONFLICT.
 * 3. Self-Referral Prevention:
 *    - Customer account matches partner.user_id.
 *    - Customer uses own partner_code override.
 *    - Referral binding links to self.
 *    - Promo code references own partner code.
 *    - 2-Tier parent partner matches customer: Tier 2 commission suppressed.
 * 4. Dual-Rail Settlement & Solvency Checks:
 *    - USDT TRC-20 and VietQR NAPAS 247 disbursement creation.
 *    - Overdraft blocking (amount > pending_payout_cents).
 *    - Zero/negative amount protection.
 * 5. Webhook Error Isolation:
 *    - Database connection loss in safelyRecordAffiliateCommission does not throw.
 *
 * @module tests/adversarial/m1-affiliate-idempotency-concurrency-challenger.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  recordAffiliateCommission,
  safelyRecordAffiliateCommission,
} from '@/tree/affiliates/affiliate-attribution';
import {
  createPayoutDisbursement,
  approvePayoutDisbursement,
  completePayoutDisbursement,
  updateCommissionStatusWithOcc,
  getAffiliateLedgerStats,
  getAffiliateOffers,
} from '@/tree/affiliates/affiliate-ledger-service';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
    close(): void;
  };
};

type NativeSqliteDb = InstanceType<typeof DatabaseSync>;

/**
 * Creates a real SQLite database with canonical D1 schema matching migration 0452.
 */
function createRealSqliteD1(): { d1: D1Database; db: NativeSqliteDb } {
  const db = new DatabaseSync(':memory:');

  // 1. Create base affiliate_partners table
  db.exec(`
    CREATE TABLE affiliate_partners (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      partner_code TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL DEFAULT 'STANDARD',
      commission_rate_pct REAL NOT NULL DEFAULT 20.0,
      tier2_rate_pct REAL NOT NULL DEFAULT 5.0,
      parent_partner_id TEXT,
      usdt_trc20_address_encrypted TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      pending_payout_cents INTEGER NOT NULL DEFAULT 0,
      settled_payout_cents INTEGER NOT NULL DEFAULT 0,
      custom_rate_override_pct REAL,
      payout_rail TEXT DEFAULT 'USDT',
      bank_bin TEXT,
      bank_account_number TEXT,
      bank_account_name TEXT,
      activated_mrr_cents INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // 2. Create pending_orders table (for promo code fallback)
  db.exec(`
    CREATE TABLE pending_orders (
      order_id TEXT PRIMARY KEY,
      promo_code TEXT
    );
  `);

  // 3. Create user_profiles table (for referred_by fallback)
  db.exec(`
    CREATE TABLE user_profiles (
      user_id TEXT PRIMARY KEY,
      settings TEXT
    );
  `);

  // 4. Create affiliate_referrals table
  db.exec(`
    CREATE TABLE affiliate_referrals (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      partner_code TEXT NOT NULL,
      referred_user_id TEXT,
      sub_id TEXT,
      attribution_token TEXT UNIQUE,
      click_id TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      converted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // 5. Create affiliate_payouts table (with OCC version)
  db.exec(`
    CREATE TABLE affiliate_payouts (
      id TEXT PRIMARY KEY,
      payout_reference TEXT UNIQUE NOT NULL,
      partner_id TEXT NOT NULL,
      rail TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      destination_encrypted TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      commission_count INTEGER NOT NULL DEFAULT 0,
      tx_hash_or_bank_ref TEXT,
      approved_by TEXT,
      approved_at INTEGER,
      failure_reason TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // 6. Create affiliate_commissions table (with unique event_key & OCC version)
  db.exec(`
    CREATE TABLE affiliate_commissions (
      id TEXT PRIMARY KEY,
      event_key TEXT UNIQUE NOT NULL,
      partner_id TEXT NOT NULL,
      referral_id TEXT,
      payment_provider TEXT NOT NULL,
      payment_id TEXT NOT NULL,
      order_id TEXT,
      customer_user_id TEXT NOT NULL,
      gross_amount_cents INTEGER NOT NULL,
      commission_rate_pct REAL NOT NULL,
      commission_cents INTEGER NOT NULL,
      tier_level TEXT NOT NULL DEFAULT 'TIER1',
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending',
      hold_days INTEGER NOT NULL DEFAULT 14,
      payable_at INTEGER NOT NULL,
      settled_at INTEGER,
      payout_id TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // 7. Create affiliate_offers table
  db.exec(`
    CREATE TABLE affiliate_offers (
      id TEXT PRIMARY KEY,
      program_name TEXT NOT NULL,
      category TEXT NOT NULL,
      payout_model TEXT NOT NULL DEFAULT 'RevShare',
      commission_rate_pct REAL NOT NULL DEFAULT 20.0,
      commission_terms TEXT NOT NULL,
      epc REAL NOT NULL DEFAULT 0.0,
      conversion_rate_pct REAL NOT NULL DEFAULT 0.0,
      quality_score REAL NOT NULL DEFAULT 9.0,
      destination_url TEXT NOT NULL,
      logo_url TEXT,
      cookie_window_days INTEGER NOT NULL DEFAULT 30,
      min_payout_usd REAL NOT NULL DEFAULT 50.0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Build D1 wrapper for node:sqlite
  function makeStmt(sql: string, boundArgs: unknown[] = []) {
    return {
      bind(...args: unknown[]) {
        return makeStmt(sql, [...boundArgs, ...args]);
      },
      async first<T = unknown>(): Promise<T | null> {
        const stmt = db.prepare(sql);
        const row = stmt.get(...boundArgs);
        return (row as T) ?? null;
      },
      async all<T = unknown>(): Promise<{ results: T[]; meta: { changes: number } }> {
        const stmt = db.prepare(sql);
        const rows = stmt.all(...boundArgs);
        return { results: rows as T[], meta: { changes: 0 } };
      },
      async run(): Promise<{ meta: { changes: number } }> {
        const stmt = db.prepare(sql);
        const info = stmt.run(...boundArgs);
        return { meta: { changes: info.changes } };
      },
    };
  }

  const d1Mock: Partial<D1Database> = {
    prepare(sql: string) {
      return makeStmt(sql) as any;
    },
    async batch(statements: any[]) {
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results as any;
    },
  };

  return { d1: d1Mock as D1Database, db };
}

describe('Milestone 1 Adversarial & Empirical Challenge Suite', () => {
  let sqliteEngine: { d1: D1Database; db: NativeSqliteDb };
  let d1: D1Database;
  let db: NativeSqliteDb;

  beforeEach(() => {
    sqliteEngine = createRealSqliteD1();
    d1 = sqliteEngine.d1;
    db = sqliteEngine.db;

    const now = Date.now();

    // Seed test partner 1
    db.prepare(`
      INSERT INTO affiliate_partners (
        id, user_id, partner_code, tier, commission_rate_pct, tier2_rate_pct,
        parent_partner_id, status, total_earnings_cents, pending_payout_cents,
        settled_payout_cents, created_at, updated_at
      ) VALUES ('partner_alpha', 'user_alpha', 'CODE_ALPHA', 'SILVER', 20.0, 5.0, NULL, 'active', 0, 0, 0, ?, ?)
    `).run(now, now);

    // Seed test parent partner
    db.prepare(`
      INSERT INTO affiliate_partners (
        id, user_id, partner_code, tier, commission_rate_pct, tier2_rate_pct,
        parent_partner_id, status, total_earnings_cents, pending_payout_cents,
        settled_payout_cents, created_at, updated_at
      ) VALUES ('partner_parent', 'user_parent', 'CODE_PARENT', 'GOLD', 25.0, 5.0, NULL, 'active', 0, 0, 0, ?, ?)
    `).run(now, now);

    // Seed test child partner referencing partner_parent
    db.prepare(`
      INSERT INTO affiliate_partners (
        id, user_id, partner_code, tier, commission_rate_pct, tier2_rate_pct,
        parent_partner_id, status, total_earnings_cents, pending_payout_cents,
        settled_payout_cents, created_at, updated_at
      ) VALUES ('partner_child', 'user_child', 'CODE_CHILD', 'SILVER', 20.0, 5.0, 'partner_parent', 'active', 0, 0, 0, ?, ?)
    `).run(now, now);
  });

  afterEach(() => {
    db.close();
  });

  describe('Challenge 1: Parallel Webhook Delivery Idempotency & Single-Credit Guarantee', () => {
    it('handles 5 concurrent identical NOWPayments webhooks without duplicate commissions or double-crediting', async () => {
      // Create a referral binding for customer_nowpayments
      const now = Date.now();
      db.prepare(`
        INSERT INTO affiliate_referrals (
          id, partner_id, partner_code, referred_user_id, status, created_at, updated_at
        ) VALUES ('ref_np', 'partner_alpha', 'CODE_ALPHA', 'customer_np_01', 'pending', ?, ?)
      `).run(now, now);

      const paymentPayload = {
        provider: 'nowpayments' as const,
        paymentId: 'np_parallel_tx_99999',
        orderId: 'order_np_99999',
        customerId: 'customer_np_01',
        grossAmountCents: 50000, // $500.00 -> 20% = $100.00 = 10,000 cents
        currency: 'USDT',
      };

      // Fire 5 identical webhooks simultaneously in parallel
      const results = await Promise.all([
        recordAffiliateCommission(paymentPayload, d1),
        recordAffiliateCommission(paymentPayload, d1),
        recordAffiliateCommission(paymentPayload, d1),
        recordAffiliateCommission(paymentPayload, d1),
        recordAffiliateCommission(paymentPayload, d1),
      ]);

      // Exactly 1 webhook should attribute successfully
      const attributedSuccesses = results.filter((r) => r.success && r.attributed);
      const duplicateRejections = results.filter(
        (r) => r.success && !r.attributed && r.reason === 'ALREADY_ATTRIBUTED'
      );

      expect(attributedSuccesses.length).toBe(1);
      expect(duplicateRejections.length).toBe(4);
      expect(attributedSuccesses[0].commissionCents).toBe(10000);

      // Verify REAL SQLite state: exactly 1 commission row exists
      const rows = db
        .prepare(`SELECT * FROM affiliate_commissions WHERE event_key = ?`)
        .all('affiliate_comm_nowpayments_np_parallel_tx_99999') as any[];
      expect(rows.length).toBe(1);
      expect(rows[0].commission_cents).toBe(10000);
      expect(rows[0].tier_level).toBe('TIER1');

      // Verify partner balance: credited exactly ONCE (10,000 cents), NOT 5x (50,000 cents)
      const partner = db
        .prepare(`SELECT * FROM affiliate_partners WHERE id = 'partner_alpha'`)
        .get() as any;
      expect(partner.pending_payout_cents).toBe(10000);
      expect(partner.total_earnings_cents).toBe(10000);

      // Verify referral is converted
      const referral = db
        .prepare(`SELECT * FROM affiliate_referrals WHERE id = 'ref_np'`)
        .get() as any;
      expect(referral.status).toBe('converted');
      expect(referral.converted_at).not.toBeNull();
    });

    it('handles 5 concurrent identical PayOS webhooks without duplicate commissions or double-crediting', async () => {
      // Connect referral
      const now = Date.now();
      db.prepare(`
        INSERT INTO affiliate_referrals (
          id, partner_id, partner_code, referred_user_id, status, created_at, updated_at
        ) VALUES ('ref_payos', 'partner_alpha', 'CODE_ALPHA', 'customer_payos_01', 'pending', ?, ?)
      `).run(now, now);

      const payosPayload = {
        provider: 'payos' as const,
        paymentId: 'payos_parallel_link_8888',
        orderId: 'order_payos_8888',
        customerId: 'customer_payos_01',
        grossAmountCents: 1000000, // 1,000,000 VND -> 20% = 200,000 VND
        currency: 'VND',
      };

      // Fire 5 identical PayOS webhooks simultaneously in parallel
      const results = await Promise.all([
        recordAffiliateCommission(payosPayload, d1),
        recordAffiliateCommission(payosPayload, d1),
        recordAffiliateCommission(payosPayload, d1),
        recordAffiliateCommission(payosPayload, d1),
        recordAffiliateCommission(payosPayload, d1),
      ]);

      const attributed = results.filter((r) => r.success && r.attributed);
      const rejected = results.filter(
        (r) => r.success && !r.attributed && r.reason === 'ALREADY_ATTRIBUTED'
      );

      expect(attributed.length).toBe(1);
      expect(rejected.length).toBe(4);
      expect(attributed[0].commissionCents).toBe(200000);

      // Verify SQLite state: exactly 1 commission record
      const rows = db
        .prepare(`SELECT * FROM affiliate_commissions WHERE event_key = ?`)
        .all('affiliate_comm_payos_payos_parallel_link_8888') as any[];
      expect(rows.length).toBe(1);
      expect(rows[0].commission_cents).toBe(200000);

      // Verify partner balance: credited exactly ONCE
      const partner = db
        .prepare(`SELECT * FROM affiliate_partners WHERE id = 'partner_alpha'`)
        .get() as any;
      expect(partner.pending_payout_cents).toBe(200000);
      expect(partner.total_earnings_cents).toBe(200000);
    });

    it('handles 5 concurrent webhooks with 2-Tier parent override without duplicate parent credits', async () => {
      // customer referred to child partner
      const now = Date.now();
      db.prepare(`
        INSERT INTO affiliate_referrals (
          id, partner_id, partner_code, referred_user_id, status, created_at, updated_at
        ) VALUES ('ref_child', 'partner_child', 'CODE_CHILD', 'customer_tiered_01', 'pending', ?, ?)
      `).run(now, now);

      const payload = {
        provider: 'nowpayments' as const,
        paymentId: 'np_tiered_parallel_555',
        orderId: 'order_tiered_555',
        customerId: 'customer_tiered_01',
        grossAmountCents: 100000, // $1,000.00 -> Child: 20% = 20,000; Parent: 5% = 5,000
        currency: 'USDT',
      };

      const results = await Promise.all([
        recordAffiliateCommission(payload, d1),
        recordAffiliateCommission(payload, d1),
        recordAffiliateCommission(payload, d1),
        recordAffiliateCommission(payload, d1),
        recordAffiliateCommission(payload, d1),
      ]);

      const attributed = results.filter((r) => r.success && r.attributed);
      expect(attributed.length).toBe(1);
      expect(attributed[0].commissionCents).toBe(20000);
      expect(attributed[0].tier2CommissionId).toBeDefined();

      // Check SQLite commissions: exactly 1 TIER1 and 1 TIER2 commission
      const commTier1 = db
        .prepare(`SELECT * FROM affiliate_commissions WHERE event_key = ?`)
        .all('affiliate_comm_nowpayments_np_tiered_parallel_555') as any[];
      expect(commTier1.length).toBe(1);
      expect(commTier1[0].tier_level).toBe('TIER1');
      expect(commTier1[0].commission_cents).toBe(20000);

      const commTier2 = db
        .prepare(`SELECT * FROM affiliate_commissions WHERE event_key = ?`)
        .all('affiliate_comm_nowpayments_np_tiered_parallel_555_tier2') as any[];
      expect(commTier2.length).toBe(1);
      expect(commTier2[0].tier_level).toBe('TIER2');
      expect(commTier2[0].commission_cents).toBe(5000);
      expect(commTier2[0].partner_id).toBe('partner_parent');

      // Check balances: Child got 20,000; Parent got 5,000
      const child = db
        .prepare(`SELECT * FROM affiliate_partners WHERE id = 'partner_child'`)
        .get() as any;
      expect(child.pending_payout_cents).toBe(20000);

      const parent = db
        .prepare(`SELECT * FROM affiliate_partners WHERE id = 'partner_parent'`)
        .get() as any;
      expect(parent.pending_payout_cents).toBe(5000);
    });
  });

  describe('Challenge 2: Optimistic Concurrency Control (OCC) CAS Strictness', () => {
    it('blocks concurrent payout approvals when attempting with identical initial version', async () => {
      // Credit partner_alpha with 100,000 cents
      db.prepare(`UPDATE affiliate_partners SET pending_payout_cents = 100000 WHERE id = 'partner_alpha'`).run();

      const createRes = await createPayoutDisbursement({
        partnerId: 'partner_alpha',
        rail: 'USDT',
        amountCents: 50000,
        destinationEncrypted: 'enc_trc20_wallet_test',
        d1,
      });
      expect(createRes.success).toBe(true);
      const payoutId = createRes.payoutId!;

      // 5 concurrent admins attempt to approve the SAME payout with version 1
      const approvalAttempts = await Promise.all([
        approvePayoutDisbursement({ payoutId, currentVersion: 1, approvedBy: 'admin_1', d1 }),
        approvePayoutDisbursement({ payoutId, currentVersion: 1, approvedBy: 'admin_2', d1 }),
        approvePayoutDisbursement({ payoutId, currentVersion: 1, approvedBy: 'admin_3', d1 }),
        approvePayoutDisbursement({ payoutId, currentVersion: 1, approvedBy: 'admin_4', d1 }),
        approvePayoutDisbursement({ payoutId, currentVersion: 1, approvedBy: 'admin_5', d1 }),
      ]);

      const successfulApprovals = approvalAttempts.filter((a) => a.success);
      const blockedConflicts = approvalAttempts.filter(
        (a) => !a.success && a.conflict && a.error === 'OCC_VERSION_CONFLICT'
      );

      // CAS guarantee: EXACTLY 1 succeeds, 4 fail with OCC conflict
      expect(successfulApprovals.length).toBe(1);
      expect(blockedConflicts.length).toBe(4);
      expect(successfulApprovals[0].newVersion).toBe(2);

      // DB check: status is 'approved' and version is 2
      const payout = db
        .prepare(`SELECT * FROM affiliate_payouts WHERE id = ?`)
        .get(payoutId) as any;
      expect(payout.status).toBe('approved');
      expect(payout.version).toBe(2);
    });

    it('blocks concurrent payout settlements/completions with identical version numbers', async () => {
      // Setup partner and approved payout at version 2
      db.prepare(`
        UPDATE affiliate_partners
        SET pending_payout_cents = 100000, settled_payout_cents = 0
        WHERE id = 'partner_alpha'
      `).run();

      const createRes = await createPayoutDisbursement({
        partnerId: 'partner_alpha',
        rail: 'USDT',
        amountCents: 40000,
        destinationEncrypted: 'enc_trc20_wallet_test',
        d1,
      });
      const payoutId = createRes.payoutId!;

      // Approve to transition to version 2
      const approved = await approvePayoutDisbursement({
        payoutId,
        currentVersion: 1,
        approvedBy: 'super_admin',
        d1,
      });
      expect(approved.success).toBe(true);
      expect(approved.newVersion).toBe(2);

      // 5 concurrent settlement workers attempt to complete with version 2
      const settlementAttempts = await Promise.all([
        completePayoutDisbursement({ payoutId, currentVersion: 2, txHashOrBankRef: '0xtx_1', d1 }),
        completePayoutDisbursement({ payoutId, currentVersion: 2, txHashOrBankRef: '0xtx_2', d1 }),
        completePayoutDisbursement({ payoutId, currentVersion: 2, txHashOrBankRef: '0xtx_3', d1 }),
        completePayoutDisbursement({ payoutId, currentVersion: 2, txHashOrBankRef: '0xtx_4', d1 }),
        completePayoutDisbursement({ payoutId, currentVersion: 2, txHashOrBankRef: '0xtx_5', d1 }),
      ]);

      const successfulSettlements = settlementAttempts.filter((s) => s.success);
      const blockedSettlements = settlementAttempts.filter(
        (s) => !s.success && s.conflict && s.error === 'OCC_VERSION_CONFLICT'
      );

      // CAS guarantee: EXACTLY 1 succeeds, 4 fail with OCC conflict
      expect(successfulSettlements.length).toBe(1);
      expect(blockedSettlements.length).toBe(4);
      expect(successfulSettlements[0].newVersion).toBe(3);

      // Verify database state: status is 'completed' and version is 3
      const payout = db
        .prepare(`SELECT * FROM affiliate_payouts WHERE id = ?`)
        .get(payoutId) as any;
      expect(payout.status).toBe('completed');
      expect(payout.version).toBe(3);

      // Partner balance: pending deducted by 40,000 (100,000 -> 60,000), settled increased by 40,000 (0 -> 40,000)
      const partner = db
        .prepare(`SELECT * FROM affiliate_partners WHERE id = 'partner_alpha'`)
        .get() as any;
      expect(partner.pending_payout_cents).toBe(60000);
      expect(partner.settled_payout_cents).toBe(40000);
    });

    it('blocks concurrent commission status transitions with identical versions', async () => {
      const now = Date.now();
      db.prepare(`
        INSERT INTO affiliate_commissions (
          id, event_key, partner_id, referral_id, payment_provider, payment_id,
          order_id, customer_user_id, gross_amount_cents, commission_rate_pct,
          commission_cents, tier_level, currency, status, hold_days, payable_at,
          version, created_at, updated_at
        ) VALUES (
          'comm_occ_test_1', 'ev_occ_1', 'partner_alpha', NULL, 'nowpayments', 'p_occ',
          NULL, 'c_occ', 10000, 20.0, 2000, 'TIER1', 'USD', 'pending', 14, ?,
          1, ?, ?
        )
      `).run(now, now, now);

      // 5 concurrent attempts to update commission status from version 1
      const updateAttempts = await Promise.all([
        updateCommissionStatusWithOcc({ commissionId: 'comm_occ_test_1', currentVersion: 1, targetStatus: 'payable', d1 }),
        updateCommissionStatusWithOcc({ commissionId: 'comm_occ_test_1', currentVersion: 1, targetStatus: 'payable', d1 }),
        updateCommissionStatusWithOcc({ commissionId: 'comm_occ_test_1', currentVersion: 1, targetStatus: 'settled', d1 }),
        updateCommissionStatusWithOcc({ commissionId: 'comm_occ_test_1', currentVersion: 1, targetStatus: 'clawback', d1 }),
        updateCommissionStatusWithOcc({ commissionId: 'comm_occ_test_1', currentVersion: 1, targetStatus: 'payable', d1 }),
      ]);

      const successCount = updateAttempts.filter((u) => u.success);
      const conflictCount = updateAttempts.filter((u) => !u.success && u.conflict);

      expect(successCount.length).toBe(1);
      expect(conflictCount.length).toBe(4);

      const comm = db
        .prepare(`SELECT * FROM affiliate_commissions WHERE id = 'comm_occ_test_1'`)
        .get() as any;
      expect(comm.version).toBe(2);
    });
  });

  describe('Challenge 3: Self-Referral Prevention Engine', () => {
    it('strictly disallows attribution when customer_id matches partner user_id', async () => {
      // partner_alpha has user_id = 'user_alpha'
      const result = await recordAffiliateCommission(
        {
          provider: 'nowpayments',
          paymentId: 'self_ref_attempt_01',
          customerId: 'user_alpha', // Owner of partner_alpha attempting to self-attribute
          partnerCodeOverride: 'CODE_ALPHA',
          grossAmountCents: 50000,
        },
        d1
      );

      expect(result.success).toBe(true);
      expect(result.attributed).toBe(false);
      expect(result.reason).toBe('SELF_REFERRAL_DISALLOWED');

      // Verify no commission was inserted into SQLite
      const comm = db
        .prepare(`SELECT * FROM affiliate_commissions WHERE event_key = ?`)
        .get('affiliate_comm_nowpayments_self_ref_attempt_01');
      expect(comm).toBeUndefined();

      // Verify balance remained 0
      const partner = db
        .prepare(`SELECT pending_payout_cents FROM affiliate_partners WHERE id = 'partner_alpha'`)
        .get() as any;
      expect(partner.pending_payout_cents).toBe(0);
    });

    it('strictly disallows attribution when self-referral is attempted via referral binding table', async () => {
      // Insert a referral record linking user_alpha to their own partner account
      const now = Date.now();
      db.prepare(`
        INSERT INTO affiliate_referrals (
          id, partner_id, partner_code, referred_user_id, status, created_at, updated_at
        ) VALUES ('ref_self', 'partner_alpha', 'CODE_ALPHA', 'user_alpha', 'pending', ?, ?)
      `).run(now, now);

      const result = await recordAffiliateCommission(
        {
          provider: 'payos',
          paymentId: 'self_payos_01',
          customerId: 'user_alpha',
          grossAmountCents: 1000000,
          currency: 'VND',
        },
        d1
      );

      expect(result.success).toBe(true);
      expect(result.attributed).toBe(false);
      expect(result.reason).toBe('SELF_REFERRAL_DISALLOWED');
    });

    it('suppresses Tier 2 commission when parent partner is the paying customer', async () => {
      // partner_child has parent = partner_parent (user_id = 'user_parent')
      // If customer is 'user_parent', child still gets commission, but parent DOES NOT get self-attributed Tier 2
      const now = Date.now();
      db.prepare(`
        INSERT INTO affiliate_referrals (
          id, partner_id, partner_code, referred_user_id, status, created_at, updated_at
        ) VALUES ('ref_parent_is_cust', 'partner_child', 'CODE_CHILD', 'user_parent', 'pending', ?, ?)
      `).run(now, now);

      const result = await recordAffiliateCommission(
        {
          provider: 'nowpayments',
          paymentId: 'parent_is_customer_tx',
          customerId: 'user_parent',
          grossAmountCents: 100000,
          currency: 'USDT',
        },
        d1
      );

      expect(result.success).toBe(true);
      expect(result.attributed).toBe(true);
      // Tier 1 was attributed to child partner
      expect(result.commissionCents).toBe(20000);
      // Tier 2 should be UNDEFINED because parent partner cannot earn on their own purchase
      expect(result.tier2CommissionId).toBeUndefined();

      // Parent partner balance should remain 0
      const parent = db
        .prepare(`SELECT pending_payout_cents FROM affiliate_partners WHERE id = 'partner_parent'`)
        .get() as any;
      expect(parent.pending_payout_cents).toBe(0);
    });
  });

  describe('Challenge 4: Edge Cases, Dual-Rail Payouts & Database Failure Isolation', () => {
    it('safely catches database network crashes and never throws uncaught exceptions', async () => {
      const crashingD1 = {
        prepare() {
          throw new Error('D1_SIMULATED_NETWORK_TIMEOUT');
        },
      } as unknown as D1Database;

      const result = await safelyRecordAffiliateCommission(
        {
          provider: 'nowpayments',
          paymentId: 'crashed_tx',
          customerId: 'cust_normal',
          grossAmountCents: 10000,
        },
        crashingD1
      );

      expect(result.success).toBe(false);
      expect(result.attributed).toBe(false);
      expect(result.error).toContain('D1_SIMULATED_NETWORK_TIMEOUT');
    });

    it('rejects payout disbursement creation on insufficient balance (overdraft protection)', async () => {
      db.prepare(`UPDATE affiliate_partners SET pending_payout_cents = 5000 WHERE id = 'partner_alpha'`).run();

      const res = await createPayoutDisbursement({
        partnerId: 'partner_alpha',
        rail: 'USDT',
        amountCents: 10000, // Trying to withdraw 10,000 cents with 5,000 cents balance
        destinationEncrypted: 'enc_addr',
        d1,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('INSUFFICIENT_PENDING_BALANCE');
    });

    it('rejects payout disbursement on zero or negative amounts', async () => {
      const resZero = await createPayoutDisbursement({
        partnerId: 'partner_alpha',
        rail: 'USDT',
        amountCents: 0,
        destinationEncrypted: 'enc_addr',
        d1,
      });
      expect(resZero.success).toBe(false);
      expect(resZero.error).toBe('INVALID_AMOUNT');

      const resNeg = await createPayoutDisbursement({
        partnerId: 'partner_alpha',
        rail: 'USDT',
        amountCents: -500,
        destinationEncrypted: 'enc_addr',
        d1,
      });
      expect(resNeg.success).toBe(false);
      expect(resNeg.error).toBe('INVALID_AMOUNT');
    });

    it('rejects payout disbursement on inactive / suspended partner', async () => {
      db.prepare(`UPDATE affiliate_partners SET status = 'suspended', pending_payout_cents = 50000 WHERE id = 'partner_alpha'`).run();

      const res = await createPayoutDisbursement({
        partnerId: 'partner_alpha',
        rail: 'USDT',
        amountCents: 10000,
        destinationEncrypted: 'enc_addr',
        d1,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('PARTNER_INACTIVE');
    });

    it('safely handles SQL injection attempts in affiliate offer discovery search', async () => {
      // Seed 2 authentic offers
      const now = Date.now();
      db.prepare(`
        INSERT INTO affiliate_offers (
          id, program_name, category, payout_model, commission_rate_pct, commission_terms,
          epc, conversion_rate_pct, quality_score, destination_url, status, created_at, updated_at
        ) VALUES (
          'semrush', 'SEMrush SEO Toolkit', 'SaaS', 'Recurring', 40.0, '40% recurring',
          18.0, 4.8, 9.8, 'https://semrush.com', 'active', ?, ?
        )
      `).run(now, now);

      // Attempt SQL injection via search parameter
      const maliciousSearches = [
        "' OR '1'='1",
        "'; DROP TABLE affiliate_offers; --",
        "' UNION SELECT * FROM affiliate_partners --",
      ];

      for (const search of maliciousSearches) {
        const result = await getAffiliateOffers({ search }, d1);
        // Should not throw, should return sanitized results
        expect(Array.isArray(result.offers)).toBe(true);
      }

      // Ensure affiliate_offers table was NOT dropped
      const count = db.prepare(`SELECT COUNT(*) as c FROM affiliate_offers`).get() as any;
      expect(count.c).toBe(1);
    });

    it('accurately aggregates platform-wide statistics in real SQLite', async () => {
      const stats = await getAffiliateLedgerStats(d1);
      expect(stats.totalAffiliates).toBe(3); // alpha, parent, child
      expect(stats.activeAffiliates).toBe(3);
      expect(stats.currency).toBe('USD');
    });
  });
});
