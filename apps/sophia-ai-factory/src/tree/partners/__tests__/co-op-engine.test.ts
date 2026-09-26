/**
 * Comprehensive Unit Test Suite: Co-Op Marketing Funds & Automated Revenue-Share Settlement
 *
 * Layer: tree/partners/__tests__/co-op-engine.test.ts
 *
 * Verifies:
 * 1. 5% Monthly Accrual Logic (Gold/Platinum eligible, Silver 0%).
 * 2. 90-Day Budget Expiration Sweep & Reclaim.
 * 3. Automated Invoice Appraisal Scoring (>= 85 auto-approved, >$2,000 threshold review gate).
 * 4. Idempotency & Duplicate Invoice Rejection per Partner.
 * 5. Multi-Rail Payout Batch Creation, FX Integer Conversion, and Atomic Rollback on Failure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateMonthlyCoOpAccrual,
  accrueMonthlyCoOpBudget,
  auditCoOpClaimInvoice,
  submitCoOpClaim,
  sweepExpiredCoOpBudgets,
  getPartnerCoOpSummary,
  CO_OP_ACCRUAL_RATE_PCT,
  CO_OP_BUDGET_EXPIRY_MS,
  AUTO_APPROVAL_SCORE_THRESHOLD,
  AUTO_APPROVAL_MAX_AMOUNT_CENTS,
} from '../co-op-engine';
import {
  createPayoutBatch,
  executePayoutBatch,
  rollbackPayoutBatch,
  convertCentsToVnd,
  USD_TO_VND_EXCHANGE_RATE,
} from '../payout-batcher';
import type { PartnerProfile, PartnerCommission } from '../types';

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

function createTestDb(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      partner_type TEXT NOT NULL CHECK(partner_type IN ('agency', 'reseller', 'affiliate', 'integrator')),
      tier TEXT NOT NULL DEFAULT 'SILVER' CHECK(tier IN ('SILVER', 'GOLD', 'PLATINUM')),
      commission_rate_pct REAL NOT NULL DEFAULT 20.0,
      referral_code TEXT NOT NULL UNIQUE,
      custom_domain TEXT UNIQUE,
      whitelabel_enabled INTEGER NOT NULL DEFAULT 0,
      total_referred_customers INTEGER NOT NULL DEFAULT 0,
      total_mrr_cents INTEGER NOT NULL DEFAULT 0,
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      pending_payout_cents INTEGER NOT NULL DEFAULT 0,
      payout_rail TEXT DEFAULT 'USDT' CHECK(payout_rail IN ('USDT', 'VIETQR', 'BANK_WIRE')),
      payout_destination_json TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending_approval')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_commissions (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      referred_tenant_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      mrr_cents INTEGER NOT NULL,
      commission_rate_pct REAL NOT NULL,
      commission_cents INTEGER NOT NULL,
      tier_at_time TEXT NOT NULL CHECK(tier_at_time IN ('SILVER', 'GOLD', 'PLATINUM')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid', 'clawed_back')),
      payout_batch_id TEXT,
      period_start INTEGER,
      period_end INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS co_op_budget_allocations (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      billing_cycle_month TEXT NOT NULL,
      tier_at_time TEXT NOT NULL CHECK(tier_at_time IN ('GOLD', 'PLATINUM')),
      mrr_basis_cents INTEGER NOT NULL,
      accrual_rate_pct REAL NOT NULL DEFAULT 5.0,
      allocated_cents INTEGER NOT NULL,
      claimed_cents INTEGER NOT NULL DEFAULT 0,
      remaining_cents INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'exhausted', 'expired', 'locked', 'closed')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE,
      UNIQUE(partner_id, billing_cycle_month),
      CHECK(claimed_cents <= allocated_cents)
    );

    CREATE TABLE IF NOT EXISTS partner_payout_batches (
      id TEXT PRIMARY KEY,
      partner_id TEXT,
      batch_type TEXT NOT NULL CHECK(batch_type IN ('commission', 'co_op_reimbursement', 'hybrid')),
      payout_rail TEXT NOT NULL CHECK(payout_rail IN ('USDT', 'VIETQR', 'BANK_WIRE')),
      total_amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD', 'VND', 'USDT')),
      total_amount_local INTEGER NOT NULL DEFAULT 0,
      fx_rate REAL NOT NULL DEFAULT 1.0,
      item_count INTEGER NOT NULL DEFAULT 0,
      destination_address TEXT,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
      external_reference TEXT,
      raw_response_json TEXT DEFAULT '{}',
      error_message TEXT,
      executed_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_co_op_claims (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      budget_allocation_id TEXT,
      campaign_name TEXT NOT NULL,
      claim_type TEXT NOT NULL CHECK(claim_type IN ('paid_ads', 'influencer_sponsorship', 'offline_event', 'creative_production', 'co_branded_content', 'digital_ads', 'event_sponsorship', 'content_creation', 'webinar', 'print_media', 'other')),
      invoice_number TEXT NOT NULL,
      invoice_url TEXT NOT NULL,
      invoice_date INTEGER NOT NULL,
      requested_amount_cents INTEGER NOT NULL,
      approved_amount_cents INTEGER NOT NULL DEFAULT 0,
      reimbursement_currency TEXT NOT NULL DEFAULT 'USDT' CHECK(reimbursement_currency IN ('USDT', 'VND')),
      status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'under_review', 'approved', 'rejected', 'processing', 'paid', 'disbursed', 'cancelled')),
      audit_score REAL DEFAULT 0.0,
      audit_notes_json TEXT DEFAULT '{}',
      rejection_reason TEXT,
      payout_batch_id TEXT,
      reviewed_by TEXT,
      reviewed_at INTEGER,
      paid_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (budget_allocation_id) REFERENCES co_op_budget_allocations(id),
      FOREIGN KEY (payout_batch_id) REFERENCES partner_payout_batches(id)
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

async function seedPartner(
  db: D1Database,
  id: string,
  userId: string,
  name: string,
  tier: 'SILVER' | 'GOLD' | 'PLATINUM',
  payoutDestinationJson: string = '{}',
  status: 'active' | 'suspended' = 'active',
) {
  const now = Date.now();
  await db
    .prepare(`
      INSERT INTO partner_profiles (
        id, user_id, tenant_id, partner_name, partner_type, tier,
        commission_rate_pct, referral_code, custom_domain, whitelabel_enabled,
        total_referred_customers, total_mrr_cents, total_earnings_cents,
        pending_payout_cents, payout_rail, payout_destination_json, status,
        created_at, updated_at
      ) VALUES (?, ?, 'tenant_test', ?, 'agency', ?, ?, ?, NULL, 0, 0, 0, 0, 0, 'USDT', ?, ?, ?, ?)
    `)
    .bind(
      id,
      userId,
      name,
      tier,
      tier === 'PLATINUM' ? 35.0 : tier === 'GOLD' ? 28.0 : 20.0,
      `ref_${id}`,
      payoutDestinationJson,
      status,
      now,
      now,
    )
    .run();
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Co-Op Marketing Fund - 5% Accrual Logic', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('guarantees 5% accrual for Gold and Platinum partners with zero penny leakage', () => {
    // $10,000 MRR (1,000,000 cents) -> 5% = $500 (50,000 cents)
    expect(calculateMonthlyCoOpAccrual(1_000_000, 'GOLD')).toBe(50_000);
    expect(calculateMonthlyCoOpAccrual(1_000_000, 'PLATINUM')).toBe(50_000);

    // $199.99 MRR (19,999 cents) -> floor(19,999 * 5 / 100) = 999 cents ($9.99)
    expect(calculateMonthlyCoOpAccrual(19_999, 'GOLD')).toBe(999);
    expect(calculateMonthlyCoOpAccrual(19_999, 'PLATINUM')).toBe(999);

    // Odd cents verification across various amounts
    expect(calculateMonthlyCoOpAccrual(1, 'GOLD')).toBe(0);
    expect(calculateMonthlyCoOpAccrual(20, 'GOLD')).toBe(1);
    expect(calculateMonthlyCoOpAccrual(100, 'GOLD')).toBe(5);
    expect(calculateMonthlyCoOpAccrual(79_900, 'PLATINUM')).toBe(3_995); // $799 -> $39.95
  });

  it('strictly returns 0% accrual for Silver tier and non-eligible partners', () => {
    expect(calculateMonthlyCoOpAccrual(1_000_000, 'SILVER')).toBe(0);
    expect(calculateMonthlyCoOpAccrual(50_000_000, 'SILVER')).toBe(0);
    expect(calculateMonthlyCoOpAccrual(19_999, 'SILVER')).toBe(0);
  });

  it('handles boundary values: zero, negative, and invalid MRR', () => {
    expect(calculateMonthlyCoOpAccrual(0, 'GOLD')).toBe(0);
    expect(calculateMonthlyCoOpAccrual(-50_000, 'GOLD')).toBe(0);
    expect(calculateMonthlyCoOpAccrual(NaN, 'PLATINUM')).toBe(0);
    expect(calculateMonthlyCoOpAccrual(Infinity, 'PLATINUM')).toBe(0);
  });

  it('accrues monthly budget in D1 with 90-day expiry for eligible partners', async () => {
    await seedPartner(db, 'partner_gold', 'user_gold', 'Alpha Media', 'GOLD');

    const result = await accrueMonthlyCoOpBudget(
      db,
      'partner_gold',
      '2026-09',
      1_000_000, // $10,000 MRR
    );

    expect(result.success).toBe(true);
    expect(result.allocatedCents).toBe(50_000);
    expect(result.allocation).toBeDefined();
    expect(result.allocation?.tier_at_time).toBe('GOLD');
    expect(result.allocation?.remaining_cents).toBe(50_000);
    expect(result.allocation?.status).toBe('active');

    // 90-day expiry verification
    const now = Date.now();
    const expiryDiff = (result.allocation?.expires_at ?? 0) - now;
    expect(expiryDiff).toBeGreaterThanOrEqual(CO_OP_BUDGET_EXPIRY_MS - 2000);
    expect(expiryDiff).toBeLessThanOrEqual(CO_OP_BUDGET_EXPIRY_MS + 2000);
  });

  it('rejects budget accrual for Silver tier with TIER_NOT_ELIGIBLE_FOR_COOP', async () => {
    await seedPartner(db, 'partner_silver', 'user_silver', 'Starter Reseller', 'SILVER');

    const result = await accrueMonthlyCoOpBudget(
      db,
      'partner_silver',
      '2026-09',
      500_000,
    );

    expect(result.success).toBe(false);
    expect(result.allocatedCents).toBe(0);
    expect(result.error).toBe('TIER_NOT_ELIGIBLE_FOR_COOP');
  });

  it('maintains idempotency: duplicate billing cycle does not double-accrue', async () => {
    await seedPartner(db, 'partner_plat', 'user_plat', 'Titan Partners', 'PLATINUM');

    const first = await accrueMonthlyCoOpBudget(db, 'partner_plat', '2026-09', 2_000_000);
    expect(first.success).toBe(true);
    expect(first.alreadyAccrued).toBe(false);

    // Duplicate call for same cycle month
    const second = await accrueMonthlyCoOpBudget(db, 'partner_plat', '2026-09', 2_000_000);
    expect(second.success).toBe(true);
    expect(second.alreadyAccrued).toBe(true);
    expect(second.allocatedCents).toBe(first.allocatedCents);
  });

  it('rejects invalid billing cycle month format', async () => {
    await seedPartner(db, 'partner_plat', 'user_plat', 'Titan Partners', 'PLATINUM');

    const result = await accrueMonthlyCoOpBudget(db, 'partner_plat', '2026-13', 100_000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_CYCLE_MONTH');

    const resultInvalid = await accrueMonthlyCoOpBudget(db, 'partner_plat', 'invalid-date', 100_000);
    expect(resultInvalid.success).toBe(false);
    expect(resultInvalid.error).toBe('INVALID_CYCLE_MONTH');
  });
});

describe('Co-Op Marketing Fund - 90-Day Expiration Sweep', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('sweeps unspent allocations older than 90 days and reclaims unused balance', async () => {
    await seedPartner(db, 'partner_plat', 'user_plat', 'Titan Partners', 'PLATINUM');

    const now = Date.now();
    const expiredTimestamp = now - 1000; // Expired 1 second ago
    const activeTimestamp = now + 45 * 86_400 * 1000; // 45 days in future

    // Allocation 1: Expired with $300 (30,000 cents) remaining
    await db
      .prepare(`
        INSERT INTO co_op_budget_allocations (
          id, partner_id, billing_cycle_month, tier_at_time, mrr_basis_cents,
          accrual_rate_pct, allocated_cents, claimed_cents, remaining_cents,
          expires_at, status, created_at, updated_at
        ) VALUES ('alloc_1', 'partner_plat', '2026-05', 'PLATINUM', 1000000, 5.0, 50000, 20000, 30000, ?, 'active', ?, ?)
      `)
      .bind(expiredTimestamp, now - 95 * 86_400 * 1000, now)
      .run();

    // Allocation 2: Expired with $500 (50,000 cents) remaining
    await db
      .prepare(`
        INSERT INTO co_op_budget_allocations (
          id, partner_id, billing_cycle_month, tier_at_time, mrr_basis_cents,
          accrual_rate_pct, allocated_cents, claimed_cents, remaining_cents,
          expires_at, status, created_at, updated_at
        ) VALUES ('alloc_2', 'partner_plat', '2026-06', 'PLATINUM', 1000000, 5.0, 50000, 0, 50000, ?, 'active', ?, ?)
      `)
      .bind(expiredTimestamp, now - 91 * 86_400 * 1000, now)
      .run();

    // Allocation 3: Active with 45 days remaining ($400 remaining)
    await db
      .prepare(`
        INSERT INTO co_op_budget_allocations (
          id, partner_id, billing_cycle_month, tier_at_time, mrr_basis_cents,
          accrual_rate_pct, allocated_cents, claimed_cents, remaining_cents,
          expires_at, status, created_at, updated_at
        ) VALUES ('alloc_3', 'partner_plat', '2026-08', 'PLATINUM', 1000000, 5.0, 50000, 10000, 40000, ?, 'active', ?, ?)
      `)
      .bind(activeTimestamp, now - 45 * 86_400 * 1000, now)
      .run();

    // Run expiration sweep
    const sweepResult = await sweepExpiredCoOpBudgets(db, now);

    expect(sweepResult.expiredCount).toBe(2);
    expect(sweepResult.reclaimedCents).toBe(80_000); // 30,000 + 50,000 = 80,000 cents ($800)

    // Verify database state: alloc_1 and alloc_2 expired, alloc_3 remains active
    const alloc1 = await db.prepare('SELECT status FROM co_op_budget_allocations WHERE id = ?').bind('alloc_1').first<{ status: string }>();
    const alloc2 = await db.prepare('SELECT status FROM co_op_budget_allocations WHERE id = ?').bind('alloc_2').first<{ status: string }>();
    const alloc3 = await db.prepare('SELECT status FROM co_op_budget_allocations WHERE id = ?').bind('alloc_3').first<{ status: string }>();

    expect(alloc1?.status).toBe('expired');
    expect(alloc2?.status).toBe('expired');
    expect(alloc3?.status).toBe('active');
  });

  it('returns 0 when no allocations are expired', async () => {
    const sweepResult = await sweepExpiredCoOpBudgets(db, Date.now());
    expect(sweepResult.expiredCount).toBe(0);
    expect(sweepResult.reclaimedCents).toBe(0);
  });
});

describe('Co-Op Marketing Fund - Automated Invoice Appraisal & Scoring', () => {
  const now = Date.now();

  it('awards 100 points and auto-approves when all 4 criteria pass and amount <= $2,000', () => {
    const result = auditCoOpClaimInvoice({
      vendorName: 'Google Ads (Singapore) Pte Ltd',
      invoiceNumber: 'INV-GOOG-2026-99',
      invoiceUrl: 'https://r2.sophia.network/invoices/goog_ads_receipt.pdf',
      invoiceDate: now - 5 * 86_400 * 1000, // 5 days ago
      requestedAmountCents: 150_000, // $1,500.00 (<= $2,000)
      availableBudgetCents: 300_000, // $3,000.00
      campaignName: 'Sophia AI Factory APAC Growth Q3',
      brandKeywords: ['Sophia', 'AI Factory'],
    });

    expect(result.auditScore).toBe(100);
    expect(result.isAutoApproved).toBe(true);
    expect(result.approvedAmountCents).toBe(150_000);
    expect(result.breakdown.vendorVerified).toBe(true);
    expect(result.breakdown.dateValid).toBe(true);
    expect(result.breakdown.proofProvided).toBe(true);
    expect(result.breakdown.budgetSufficient).toBe(true);
  });

  it('routes to manual review (under_review) when score >= 85 but amount exceeds $2,000', () => {
    const result = auditCoOpClaimInvoice({
      vendorName: 'Meta Ads Manager (Facebook/Instagram)',
      invoiceNumber: 'INV-META-2026-101',
      invoiceUrl: 'https://r2.sophia.network/invoices/meta_ads.pdf',
      invoiceDate: now - 3 * 86_400 * 1000,
      requestedAmountCents: 200_001, // $2,000.01 (> $2,000.00 ceiling)
      availableBudgetCents: 500_000,
      campaignName: 'Sophia AgencyOS Lead Gen',
    });

    expect(result.auditScore).toBe(100);
    expect(result.isAutoApproved).toBe(false); // Ceiling prevents auto-approval!
    expect(result.approvedAmountCents).toBe(0);
    expect(result.notes.some((n) => n.includes('exceeds $2,000 threshold'))).toBe(true);
  });

  it('deducts 25 points when vendor is not on whitelist and routes to under_review', () => {
    const result = auditCoOpClaimInvoice({
      vendorName: 'Random Unverified Agency LLC',
      invoiceNumber: 'INV-UNKNOWN-01',
      invoiceUrl: 'https://r2.sophia.network/invoices/bill.pdf',
      invoiceDate: now - 2 * 86_400 * 1000,
      requestedAmountCents: 50_000, // $500
      availableBudgetCents: 100_000,
      campaignName: 'Sophia Influencer Campaign',
    });

    expect(result.auditScore).toBe(75); // 100 - 25 = 75 (< 85)
    expect(result.isAutoApproved).toBe(false);
    expect(result.breakdown.vendorVerified).toBe(false);
  });

  it('deducts 25 points when date falls outside billing cycle window + grace period', () => {
    const periodStart = now - 60 * 86_400 * 1000;
    const periodEnd = now - 30 * 86_400 * 1000;
    const outsideDate = now; // 30 days after periodEnd, exceeds 15-day grace

    const result = auditCoOpClaimInvoice({
      vendorName: 'TikTok Ads',
      invoiceNumber: 'INV-TT-01',
      invoiceUrl: 'https://r2.sophia.network/invoices/tt.pdf',
      invoiceDate: outsideDate,
      periodStart,
      periodEnd,
      requestedAmountCents: 50_000,
      availableBudgetCents: 100_000,
      campaignName: 'Sophia TikTok Shorts Campaign',
    });

    expect(result.breakdown.dateValid).toBe(false);
    expect(result.auditScore).toBe(75);
    expect(result.isAutoApproved).toBe(false);
  });

  it('deducts 25 points when proof lacks Sophia brand keywords', () => {
    const result = auditCoOpClaimInvoice({
      vendorName: 'Google Ads',
      invoiceNumber: 'INV-GOOG-88',
      invoiceUrl: 'https://r2.sophia.network/invoices/receipt.pdf',
      invoiceDate: now - 2 * 86_400 * 1000,
      requestedAmountCents: 30_000,
      availableBudgetCents: 100_000,
      campaignName: 'Generic Marketing Campaign 123', // No Sophia keywords
    });

    expect(result.breakdown.proofProvided).toBe(false);
    expect(result.auditScore).toBe(75);
    expect(result.isAutoApproved).toBe(false);
  });

  it('deducts 25 points when requested amount exceeds available budget', () => {
    const result = auditCoOpClaimInvoice({
      vendorName: 'Google Ads',
      invoiceNumber: 'INV-GOOG-89',
      invoiceUrl: 'https://r2.sophia.network/invoices/receipt.pdf',
      invoiceDate: now - 2 * 86_400 * 1000,
      requestedAmountCents: 100_000, // $1,000 requested
      availableBudgetCents: 50_000,  // Only $500 available
      campaignName: 'Sophia Search Ads',
    });

    expect(result.breakdown.budgetSufficient).toBe(false);
    expect(result.auditScore).toBe(75);
    expect(result.isAutoApproved).toBe(false);
  });
});

describe('Co-Op Marketing Fund - Claim Ingestion & Idempotency', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createTestDb();
    await seedPartner(db, 'partner_gold', 'user_gold', 'Apex Media', 'GOLD');

    // Seed active budget allocation: $5,000 available
    const now = Date.now();
    await db
      .prepare(`
        INSERT INTO co_op_budget_allocations (
          id, partner_id, billing_cycle_month, tier_at_time, mrr_basis_cents,
          accrual_rate_pct, allocated_cents, claimed_cents, remaining_cents,
          expires_at, status, created_at, updated_at
        ) VALUES ('alloc_apex', 'partner_gold', '2026-09', 'GOLD', 10000000, 5.0, 500000, 0, 500000, ?, 'active', ?, ?)
      `)
      .bind(now + CO_OP_BUDGET_EXPIRY_MS, now, now)
      .run();
  });

  it('submits claim, auto-approves compliant invoice, and atomically deducts remaining budget', async () => {
    const result = await submitCoOpClaim(db, {
      partnerId: 'partner_gold',
      campaignName: 'Sophia AI Factory Google Search Ads',
      claimType: 'paid_ads',
      invoiceNumber: 'INV-APEX-001',
      invoiceUrl: 'https://r2.sophia.network/invoices/google_ads.pdf',
      invoiceDate: Date.now() - 86_400 * 1000,
      requestedAmountCents: 100_000, // $1,000
      reimbursementCurrency: 'USDT',
      vendorName: 'Google Ads',
    });

    expect(result.success).toBe(true);
    expect(result.claim).toBeDefined();
    expect(result.claim?.status).toBe('approved');
    expect(result.claim?.approved_amount_cents).toBe(100_000);
    expect(result.auditResult?.isAutoApproved).toBe(true);

    // Verify allocation remaining budget decremented from 500,000 to 400,000 cents
    const alloc = await db
      .prepare('SELECT claimed_cents, remaining_cents, status FROM co_op_budget_allocations WHERE id = ?')
      .bind('alloc_apex')
      .first<{ claimed_cents: number; remaining_cents: number; status: string }>();

    expect(alloc?.claimed_cents).toBe(100_000);
    expect(alloc?.remaining_cents).toBe(400_000);
    expect(alloc?.status).toBe('active');
  });

  it('enforces idempotency: rejects duplicate invoice submission from same partner', async () => {
    const claimPayload = {
      partnerId: 'partner_gold',
      campaignName: 'Sophia Meta Ads',
      claimType: 'paid_ads' as const,
      invoiceNumber: 'INV-DUPLICATE-TEST-01',
      invoiceUrl: 'https://r2.sophia.network/invoices/meta.pdf',
      invoiceDate: Date.now() - 86_400 * 1000,
      requestedAmountCents: 50_000,
      reimbursementCurrency: 'USDT' as const,
      vendorName: 'Meta Ads',
    };

    const first = await submitCoOpClaim(db, claimPayload);
    expect(first.success).toBe(true);

    // Duplicate submission attempt
    const second = await submitCoOpClaim(db, claimPayload);
    expect(second.success).toBe(false);
    expect(second.error).toBe('DUPLICATE_INVOICE_SUBMISSION');
  });

  it('rejects claim when requested amount exceeds total available Co-Op budget', async () => {
    const result = await submitCoOpClaim(db, {
      partnerId: 'partner_gold',
      campaignName: 'Sophia Massive Billboard',
      claimType: 'offline_event',
      invoiceNumber: 'INV-OVERBUDGET-01',
      invoiceUrl: 'https://r2.sophia.network/invoices/billboard.pdf',
      invoiceDate: Date.now() - 86_400 * 1000,
      requestedAmountCents: 1_000_000, // $10,000 (Available is only $5,000)
      reimbursementCurrency: 'USDT',
      vendorName: 'City Outdoor Media',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('INSUFFICIENT_CO_OP_BUDGET');
  });

  it('routes non-auto-approved claims to under_review without premature budget deduction', async () => {
    const result = await submitCoOpClaim(db, {
      partnerId: 'partner_gold',
      campaignName: 'Generic Local Radio Ads', // Missing Sophia brand keywords
      claimType: 'other',
      invoiceNumber: 'INV-REVIEW-01',
      invoiceUrl: 'https://r2.sophia.network/invoices/radio.pdf',
      invoiceDate: Date.now() - 86_400 * 1000,
      requestedAmountCents: 50_000,
      reimbursementCurrency: 'USDT',
      vendorName: 'Unrecognized Local Station',
    });

    expect(result.success).toBe(true);
    expect(result.claim?.status).toBe('under_review');
    expect(result.claim?.approved_amount_cents).toBe(0);

    // Budget should NOT be deducted yet since it is under review
    const alloc = await db
      .prepare('SELECT claimed_cents, remaining_cents FROM co_op_budget_allocations WHERE id = ?')
      .bind('alloc_apex')
      .first<{ claimed_cents: number; remaining_cents: number }>();

    expect(alloc?.claimed_cents).toBe(0);
    expect(alloc?.remaining_cents).toBe(500_000);
  });

  it('aggregates partner Co-Op summary accurately', async () => {
    const summary = await getPartnerCoOpSummary(db, 'partner_gold');
    expect(summary).toBeDefined();
    expect(summary?.isEligible).toBe(true);
    expect(summary?.totalAllocatedCents).toBe(500_000);
    expect(summary?.remainingActiveBudgetCents).toBe(500_000);
    expect(summary?.accrualRatePct).toBe(CO_OP_ACCRUAL_RATE_PCT);
  });
});

describe('Multi-Rail Payout Batcher & Atomic Rollback', () => {
  let db: D1Database;
  const partnerId = 'partner_payout_test';

  beforeEach(async () => {
    db = createTestDb();
    const destination = JSON.stringify({
      usdtAddress: 'TXYZ1234567890abcdefTRC20Address',
      bankCode: '970436', // Vietcombank
      bankAccountNumber: '0123456789',
    });
    await seedPartner(db, partnerId, 'user_payout', 'Global Media Hub', 'PLATINUM', destination);

    const now = Date.now();
    // Seed 2 pending commissions ($100 each = 10,000 cents)
    await db
      .prepare(`
        INSERT INTO partner_commissions (
          id, partner_id, referred_user_id, referred_tenant_id, order_id,
          mrr_cents, commission_rate_pct, commission_cents, tier_at_time, status,
          payout_batch_id, created_at
        ) VALUES
        ('comm_1', ?, 'ref_u1', 'ref_t1', 'order_1', 28571, 35.0, 10000, 'PLATINUM', 'pending', NULL, ?),
        ('comm_2', ?, 'ref_u2', 'ref_t2', 'order_2', 28571, 35.0, 10000, 'PLATINUM', 'pending', NULL, ?)
      `)
      .bind(partnerId, now, partnerId, now)
      .run();

    // Seed 1 approved Co-Op claim ($300 = 30,000 cents)
    await db
      .prepare(`
        INSERT INTO partner_co_op_claims (
          id, partner_id, budget_allocation_id, campaign_name, claim_type,
          invoice_number, invoice_url, invoice_date, requested_amount_cents,
          approved_amount_cents, reimbursement_currency, status, audit_score,
          payout_batch_id, created_at, updated_at
        ) VALUES (
          'claim_approved_1', ?, NULL, 'Sophia Video Campaign', 'paid_ads',
          'INV-BATCH-01', 'https://r2.sophia.network/inv.pdf', ?, 30000,
          30000, 'USDT', 'approved', 95.0, NULL, ?, ?
        )
      `)
      .bind(partnerId, now, now, now)
      .run();
  });

  it('creates a hybrid payout batch claiming commissions and co-op claims using OCC CAS', async () => {
    const batchResult = await createPayoutBatch(
      db,
      partnerId,
      'hybrid',
      'USDT',
      'USDT',
    );

    expect(batchResult.success).toBe(true);
    expect(batchResult.itemCount).toBe(3); // 2 commissions + 1 claim
    expect(batchResult.totalAmountCents).toBe(50_000); // 10,000 + 10,000 + 30,000 = 50,000 cents ($500)
    expect(batchResult.commissionsClaimedCount).toBe(2);
    expect(batchResult.coOpClaimsClaimedCount).toBe(1);

    const batchId = batchResult.batch?.id ?? '';

    // Verify commissions updated to 'approved' and bound to batchId
    const comm1 = await db.prepare('SELECT status, payout_batch_id FROM partner_commissions WHERE id = ?').bind('comm_1').first<{ status: string; payout_batch_id: string }>();
    expect(comm1?.status).toBe('approved');
    expect(comm1?.payout_batch_id).toBe(batchId);

    // Verify claim updated to 'processing' and bound to batchId
    const claim1 = await db.prepare('SELECT status, payout_batch_id FROM partner_co_op_claims WHERE id = ?').bind('claim_approved_1').first<{ status: string; payout_batch_id: string }>();
    expect(claim1?.status).toBe('processing');
    expect(claim1?.payout_batch_id).toBe(batchId);
  });

  it('calculates VietQR PayOS local currency with clean integer dong conversion', async () => {
    // $500.00 = 50,000 cents
    // At rate 25,450 VND / USD: Math.floor((50,000 * 25,450) / 100) = 12,725,000 VND
    const vndAmount = convertCentsToVnd(50_000, USD_TO_VND_EXCHANGE_RATE);
    expect(vndAmount).toBe(12_725_000);
    expect(Number.isInteger(vndAmount)).toBe(true);

    const batchResult = await createPayoutBatch(
      db,
      partnerId,
      'hybrid',
      'VIETQR',
      'VND',
    );

    expect(batchResult.success).toBe(true);
    expect(batchResult.batch?.total_amount_local).toBe(12_725_000);
    expect(batchResult.batch?.fx_rate).toBe(USD_TO_VND_EXCHANGE_RATE);
  });

  it('executes payout batch successfully and marks items paid', async () => {
    const batchResult = await createPayoutBatch(db, partnerId, 'hybrid', 'USDT', 'USDT');
    const batchId = batchResult.batch?.id ?? '';

    const execResult = await executePayoutBatch(db, batchId);
    expect(execResult.success).toBe(true);
    expect(execResult.externalReference).toBeDefined();

    // Verify batch status completed
    const batch = await db.prepare('SELECT status, completed_at, external_reference FROM partner_payout_batches WHERE id = ?').bind(batchId).first<{ status: string; completed_at: number; external_reference: string }>();
    expect(batch?.status).toBe('completed');
    expect(batch?.completed_at).toBeGreaterThan(0);

    // Verify commissions marked 'paid'
    const comms = await db.prepare('SELECT status FROM partner_commissions WHERE payout_batch_id = ?').bind(batchId).all<{ status: string }>();
    expect(comms.results?.every((c) => c.status === 'paid')).toBe(true);

    // Verify claim marked 'paid'
    const claim = await db.prepare('SELECT status, paid_at FROM partner_co_op_claims WHERE payout_batch_id = ?').bind(batchId).first<{ status: string; paid_at: number }>();
    expect(claim?.status).toBe('paid');
    expect(claim?.paid_at).toBeGreaterThan(0);

    // Verify partner profile lifetime earnings updated
    const partner = await db.prepare('SELECT total_earnings_cents FROM partner_profiles WHERE id = ?').bind(partnerId).first<{ total_earnings_cents: number }>();
    expect(partner?.total_earnings_cents).toBe(50_000);
  });

  it('guarantees atomic rollback on gateway failure: reverts all records without fund loss', async () => {
    const batchResult = await createPayoutBatch(db, partnerId, 'hybrid', 'USDT', 'USDT');
    const batchId = batchResult.batch?.id ?? '';

    // Mock failing payment gateway (simulating HTTP 504 or network break)
    const failingGateway = async () => {
      throw new Error('NOWPAYMENTS_GATEWAY_TIMEOUT: 504 Gateway Timeout during TRC-20 broadcast');
    };

    const execResult = await executePayoutBatch(db, batchId, failingGateway);

    expect(execResult.success).toBe(false);
    expect(execResult.error).toContain('NOWPAYMENTS_GATEWAY_TIMEOUT');

    // 1. Batch status must be 'failed'
    const batch = await db.prepare('SELECT status, error_message FROM partner_payout_batches WHERE id = ?').bind(batchId).first<{ status: string; error_message: string }>();
    expect(batch?.status).toBe('failed');
    expect(batch?.error_message).toContain('NOWPAYMENTS_GATEWAY_TIMEOUT');

    // 2. Commissions must atomically revert to 'pending' and clear payout_batch_id
    const comms = await db.prepare('SELECT id, status, payout_batch_id FROM partner_commissions WHERE partner_id = ?').bind(partnerId).all<{ id: string; status: string; payout_batch_id: string | null }>();
    expect(comms.results?.length).toBe(2);
    for (const c of comms.results ?? []) {
      expect(c.status).toBe('pending');
      expect(c.payout_batch_id).toBeNull();
    }

    // 3. Co-Op claims must atomically revert to 'approved' and clear payout_batch_id
    const claim = await db.prepare('SELECT status, payout_batch_id FROM partner_co_op_claims WHERE id = ?').bind('claim_approved_1').first<{ status: string; payout_batch_id: string | null }>();
    expect(claim?.status).toBe('approved');
    expect(claim?.payout_batch_id).toBeNull();

    // 4. Partner profile earnings must NOT be incremented
    const partner = await db.prepare('SELECT total_earnings_cents FROM partner_profiles WHERE id = ?').bind(partnerId).first<{ total_earnings_cents: number }>();
    expect(partner?.total_earnings_cents).toBe(0);
  });
});
