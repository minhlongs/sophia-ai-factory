/**
 * Unit Test Suite: Partner Co-Op & Settlement Server Actions
 *
 * Layer: land/partners/__tests__/co-op-actions.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  verifyPartnerOwnership,
  accrueMonthlyCoOpBudgetAction,
  submitCoOpClaimAction,
  auditCoOpClaimInvoiceAction,
  sweepExpiredCoOpBudgetsAction,
  createPayoutBatchAction,
  executePayoutBatchAction,
  disburseApprovedClaimAction,
  getPartnerCoOpSummaryAction,
  getPartnerCoOpAllocationsAction,
  getPartnerCoOpClaimsAction,
  getPayoutBatchByIdAction,
  getPartnerPayoutBatchesAction,
} from '../co-op-actions';

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

const mocks = vi.hoisted(() => ({
  db: null as unknown as D1Database,
  user: { id: 'usr_owner_1', role: 'user' } as { id: string; role?: string } | null,
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(async () => mocks.user),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => mocks.db),
}));

function setupTestDb(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      partner_type TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'SILVER',
      status TEXT NOT NULL DEFAULT 'active',
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      pending_payout_cents INTEGER NOT NULL DEFAULT 0,
      payout_destination_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS co_op_budget_allocations (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      billing_cycle_month TEXT NOT NULL,
      tier_at_time TEXT NOT NULL,
      mrr_basis_cents INTEGER NOT NULL,
      accrual_rate_pct REAL NOT NULL,
      allocated_cents INTEGER NOT NULL,
      claimed_cents INTEGER NOT NULL DEFAULT 0,
      remaining_cents INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(partner_id, billing_cycle_month)
    );

    CREATE TABLE IF NOT EXISTS partner_co_op_claims (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      budget_allocation_id TEXT,
      campaign_name TEXT NOT NULL,
      claim_type TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_url TEXT NOT NULL,
      invoice_date INTEGER NOT NULL,
      requested_amount_cents INTEGER NOT NULL,
      approved_amount_cents INTEGER NOT NULL DEFAULT 0,
      reimbursement_currency TEXT NOT NULL DEFAULT 'USDT',
      status TEXT NOT NULL DEFAULT 'submitted',
      rejection_reason TEXT,
      audit_score REAL NOT NULL DEFAULT 0,
      audit_notes_json TEXT DEFAULT '{}',
      payout_batch_id TEXT,
      reviewed_by TEXT,
      reviewed_at INTEGER,
      paid_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(partner_id, invoice_number)
    );

    CREATE TABLE IF NOT EXISTS partner_commissions (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      referred_user_id TEXT,
      referred_tenant_id TEXT,
      order_id TEXT,
      mrr_cents INTEGER,
      commission_rate_pct REAL,
      commission_cents INTEGER,
      tier_at_time TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      payout_batch_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_payout_batches (
      id TEXT PRIMARY KEY,
      partner_id TEXT,
      batch_type TEXT NOT NULL,
      payout_rail TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      fx_rate REAL NOT NULL DEFAULT 1.0,
      total_amount_cents INTEGER NOT NULL,
      total_amount_local INTEGER NOT NULL DEFAULT 0,
      item_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      destination_address TEXT,
      external_reference TEXT,
      tx_hash TEXT,
      raw_response_json TEXT DEFAULT '{}',
      error_message TEXT,
      created_at INTEGER NOT NULL,
      executed_at INTEGER,
      completed_at INTEGER,
      updated_at INTEGER NOT NULL
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...params: unknown[]) {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            async first<T = unknown>() {
              return (stmt.get(...sanitized) as T) ?? null;
            },
            async all<T = unknown>() {
              const rows = stmt.all(...sanitized) as T[];
              return { results: rows, success: true, meta: { changes: 0 } };
            },
            async run() {
              const result = stmt.run(...sanitized);
              return { success: true, meta: { changes: result.changes } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe('Partner Co-Op Server Actions & Ownership Guard', () => {
  beforeEach(() => {
    mocks.db = setupTestDb();
    mocks.user = { id: 'usr_owner_1', role: 'user' };

    const now = Date.now();
    mocks.db.prepare(`
      INSERT INTO partner_profiles (
        id, user_id, tenant_id, partner_name, partner_type, tier, status, created_at, updated_at
      ) VALUES ('partner_1', 'usr_owner_1', 'tenant_1', 'Alpha Agency', 'agency', 'GOLD', 'active', ?, ?)
    `).bind(now, now).run();
  });

  it('verifyPartnerOwnership should allow owner and deny non-owner', async () => {
    const ownerRes = await verifyPartnerOwnership(mocks.db, 'partner_1', 'usr_owner_1', 'user');
    expect(ownerRes.ok).toBe(true);

    const nonOwnerRes = await verifyPartnerOwnership(mocks.db, 'partner_1', 'usr_attacker', 'user');
    expect(nonOwnerRes.ok).toBe(false);

    const adminRes = await verifyPartnerOwnership(mocks.db, 'partner_1', 'usr_admin', 'admin');
    expect(adminRes.ok).toBe(true);
  });

  it('accrueMonthlyCoOpBudgetAction should enforce auth and calculate budget', async () => {
    const res = await accrueMonthlyCoOpBudgetAction({
      partnerId: 'partner_1',
      cycleMonth: '2026-05',
      mrrCents: 1_000_000,
      tier: 'GOLD',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.allocated_cents).toBe(50_000);
      expect(res.value.status).toBe('active');
    }
  });

  it('submitCoOpClaimAction should submit and evaluate appraisal score', async () => {
    // First fund budget
    await accrueMonthlyCoOpBudgetAction({
      partnerId: 'partner_1',
      cycleMonth: '2026-05',
      mrrCents: 1_000_000,
      tier: 'GOLD',
    });

    const res = await submitCoOpClaimAction({
      partnerId: 'partner_1',
      campaignName: 'Q2 YouTube Co-Op Campaign',
      claimType: 'paid_ads',
      invoiceNumber: 'INV-2026-001',
      invoiceUrl: 'https://storage.example.com/inv1.pdf',
      invoiceDate: Date.now() - 5 * 86_400_000,
      requestedAmountCents: 30_000,
      vendorName: 'Google Ads LLC',
      brandKeywords: ['Sophia AI', 'AI Video Factory'],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.status).toBe('approved');
      expect(res.value.approved_amount_cents).toBe(30_000);
    }
  });

  it('auditCoOpClaimInvoiceAction should return preview score', async () => {
    const res = await auditCoOpClaimInvoiceAction({
      partnerId: 'partner_1',
      invoiceNumber: 'INV-TEST',
      invoiceUrl: 'https://valid.url/invoice.pdf',
      invoiceDate: Date.now() - 10 * 86_400_000,
      requestedAmountCents: 50_000,
      availableBudgetCents: 100_000,
      vendorName: 'Meta Ads',
      brandKeywords: ['Sophia'],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.auditScore).toBeGreaterThanOrEqual(75);
    }
  });

  it('sweepExpiredCoOpBudgetsAction should require admin role', async () => {
    mocks.user = { id: 'usr_owner_1', role: 'user' };
    const userRes = await sweepExpiredCoOpBudgetsAction();
    expect(userRes.ok).toBe(false);

    mocks.user = { id: 'usr_admin_1', role: 'admin' };
    const adminRes = await sweepExpiredCoOpBudgetsAction();
    expect(adminRes.ok).toBe(true);
  });

  it('createPayoutBatchAction and executePayoutBatchAction should create and execute payout', async () => {
    mocks.user = { id: 'usr_owner_1', role: 'user' };
    // Add pending commission
    const now = Date.now();
    await mocks.db.prepare(`
      INSERT INTO partner_commissions (id, partner_id, status, commission_cents, created_at)
      VALUES ('comm_1', 'partner_1', 'pending', 25000, ?)
    `).bind(now).run();

    const batchRes = await createPayoutBatchAction({
      partnerId: 'partner_1',
      batchType: 'commission',
      rail: 'USDT',
      destinationAddress: 'TRX_TEST_WALLET_123',
    });

    expect(batchRes.ok).toBe(true);
    if (batchRes.ok && batchRes.value.batch) {
      const batchId = batchRes.value.batch.id;
      const execRes = await executePayoutBatchAction(batchId);
      expect(execRes.ok).toBe(true);
      if (execRes.ok) {
        expect(execRes.value.status).toBe('completed');
      }
    }
  });

  it('getPartnerCoOpSummaryAction, allocations, and claims queries should succeed', async () => {
    const summaryRes = await getPartnerCoOpSummaryAction('partner_1');
    expect(summaryRes.ok).toBe(true);

    const allocsRes = await getPartnerCoOpAllocationsAction('partner_1');
    expect(allocsRes.ok).toBe(true);

    const claimsRes = await getPartnerCoOpClaimsAction('partner_1');
    expect(claimsRes.ok).toBe(true);
  });
});
