/**
 * Unit Test Suite: Enterprise Quote-to-Cash Workflow & Server Actions
 *
 * Verifies the complete end-to-end enterprise contract monetization lifecycle:
 * - Quote generation with volume & annual discount calculations
 * - Quote-to-contract conversion with RFC-8785 SHA-256 contract hashing
 * - Dual-sided cryptographic signing (customer + platform counter-signature)
 * - Dual-rail checkout initiation (NOWPayments USDT & PayOS VietQR)
 * - Payment fulfillment: E-invoice paid, MCU credit provisioning, deal closing, and idempotency
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import {
  createEnterpriseQuote,
  getQuoteById,
  convertQuoteToContract,
  getContractById,
  executeContractSigning,
  initiateContractPayment,
  fulfillContractPayment,
} from '@/land/contracts/quote-to-cash-workflow';

// Mock dependencies
const mockCheckout = vi.fn().mockResolvedValue({
  invoiceUrl: 'https://nowpayments.io/payment/?iid=nowp_inv_123',
  orderId: 'sophia_contract_order_123',
  invoiceId: 'nowp_inv_123',
});

const mockPayOsInvoice = vi.fn().mockResolvedValue({
  checkoutUrl: 'https://payos.vn/gate/payos_order_123',
  qrUrl: 'https://img.vietqr.io/image/970422-0000-compact2.png',
  paymentLinkId: 'link_123',
  orderCode: 123456789,
  expiresAt: '2026-10-01T00:00:00Z',
});

vi.mock('@/tree/clients/nowpayments-client', () => ({
  createCheckout: (...args: unknown[]) => mockCheckout(...args),
}));

vi.mock('@/land/payments/payos', () => ({
  createPayOsInvoice: (...args: unknown[]) => mockPayOsInvoice(...args),
}));

let mockD1Instance: D1Database;

vi.mock('@/seed/db/client', () => ({
  getD1: () => Promise.resolve(mockD1Instance),
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { role: 'admin' } }),
        }),
      }),
    }),
  }),
}));

function setupTestDatabase(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      org_id TEXT NOT NULL,
      subaccount_id TEXT,
      tier TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'annual',
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      fx_rate REAL NOT NULL DEFAULT 1.0,
      tax_id TEXT,
      legal_name TEXT NOT NULL,
      billing_address TEXT NOT NULL,
      vat_rate REAL NOT NULL DEFAULT 0.0,
      vat_amount_cents INTEGER NOT NULL DEFAULT 0,
      total_amount_cents INTEGER NOT NULL,
      tax_form_type TEXT NOT NULL DEFAULT 'NONE',
      status TEXT NOT NULL DEFAULT 'draft',
      pdf_r2_key TEXT,
      paid_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS enterprise_quotes (
      id TEXT PRIMARY KEY,
      deal_id TEXT,
      org_id TEXT NOT NULL,
      quote_number TEXT NOT NULL UNIQUE,
      mcu_capacity_monthly INTEGER NOT NULL,
      sla_uptime_percent REAL NOT NULL DEFAULT 99.9,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      base_price_cents INTEGER NOT NULL,
      volume_discount_percent REAL NOT NULL,
      annual_discount_percent REAL NOT NULL DEFAULT 0.0,
      final_price_cents INTEGER NOT NULL,
      final_price_vnd INTEGER,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'draft',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS enterprise_contracts (
      id TEXT PRIMARY KEY,
      deal_id TEXT,
      org_id TEXT NOT NULL,
      quote_id TEXT,
      contract_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft',
      sla_uptime_percent REAL NOT NULL DEFAULT 99.9,
      mcu_capacity_monthly INTEGER NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      unit_price_per_mcu_cents REAL NOT NULL,
      volume_discount_percent REAL NOT NULL,
      monthly_commitment_cents INTEGER NOT NULL,
      annual_commitment_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      contract_sha256 TEXT NOT NULL,
      terms_version TEXT NOT NULL DEFAULT '2026.1-ENTERPRISE-SLA',
      customer_signer_name TEXT,
      customer_signer_email TEXT,
      customer_signer_title TEXT,
      customer_signer_ip TEXT,
      customer_signature_hash TEXT,
      customer_signed_at INTEGER,
      platform_signature_hash TEXT,
      platform_signed_at INTEGER,
      effective_date TEXT NOT NULL,
      expiration_date TEXT NOT NULL,
      payment_rail TEXT,
      last_invoice_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS user_mcu_balance (
      user_id TEXT PRIMARY KEY,
      credits_remaining INTEGER NOT NULL DEFAULT 0,
      credits_total_purchased INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS mcu_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS enterprise_deals (
      id TEXT PRIMARY KEY,
      deal_stage TEXT NOT NULL DEFAULT 'negotiation',
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    INSERT INTO organizations (id, name) VALUES ('org_globex', 'Globex Corporation');
    INSERT INTO enterprise_deals (id, deal_stage) VALUES ('deal_globex_1', 'negotiation');
  `);

  const d1 = {
    raw: db,
    prepare(sql: string) {
      // Normalize parameter placeholders for SQLite (?1 -> ?)
      const normalizedSql = sql.replace(/\?(\d+)/g, '?');
      const stmt = db.prepare(normalizedSql);
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              const res = stmt.get(...args);
              return (res ?? null) as T;
            },
            async all<T>(): Promise<{ results: T[] }> {
              const res = stmt.all(...args);
              return { results: res as T[] };
            },
            async run(): Promise<{ success: boolean; meta: { changes: number } }> {
              const info = stmt.run(...args);
              return { success: true, meta: { changes: Number(info.changes) } };
            },
          };
        },
      };
    },
  };

  return d1 as unknown as D1Database;
}

describe('Enterprise Quote-to-Cash Workflow', () => {
  let db: D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    db = setupTestDatabase();
    mockD1Instance = db;
  });

  describe('createEnterpriseQuote & getQuoteById', () => {
    it('creates an enterprise volume quote with correct 30% discount for 100K MCU', async () => {
      const quote = await createEnterpriseQuote(db, {
        orgId: 'org_globex',
        mcuCapacityMonthly: 100_000,
        billingCycle: 'monthly',
        dealId: 'deal_globex_1',
      });

      expect(quote.id).toMatch(/^eq_/);
      expect(quote.quoteNumber).toMatch(/^Q-\d{8}-[A-Z0-9]{4}$/);
      expect(quote.orgId).toBe('org_globex');
      expect(quote.dealId).toBe('deal_globex_1');
      expect(quote.mcuCapacityMonthly).toBe(100_000);
      expect(quote.volumeDiscountPercent).toBe(0.30);
      expect(quote.basePriceCents).toBe(500_000); // 100K * $0.050 = $5,000
      expect(quote.finalPriceCents).toBe(350_000); // $3,500
      expect(quote.status).toBe('draft');
      expect(quote.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

      // Retrieve by ID
      const retrieved = await getQuoteById(db, quote.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(quote.id);
      expect(retrieved?.finalPriceCents).toBe(350_000);
    });

    it('creates an annual quote with 17% annual prepayment discount applied', async () => {
      const quote = await createEnterpriseQuote(db, {
        orgId: 'org_globex',
        mcuCapacityMonthly: 50_000,
        billingCycle: 'annual',
      });

      expect(quote.billingCycle).toBe('annual');
      expect(quote.volumeDiscountPercent).toBe(0.20);
      expect(quote.annualDiscountPercent).toBe(0.17);
      // 50K * $0.0400 = $2,000/mo * 12 = $24,000. 17% savings = $4,080. Net = $19,920 (1,992,000 cents)
      expect(quote.finalPriceCents).toBe(1_992_000);
    });
  });

  describe('convertQuoteToContract', () => {
    it('converts draft quote into pending_signature SLA contract with RFC-8785 SHA-256 hash', async () => {
      const quote = await createEnterpriseQuote(db, {
        orgId: 'org_globex',
        mcuCapacityMonthly: 250_000,
        billingCycle: 'monthly',
        dealId: 'deal_globex_1',
      });

      const contract = await convertQuoteToContract(db, quote.id);

      expect(contract.id).toMatch(/^ec_/);
      expect(contract.contractNumber).toMatch(/^CNT-\d{8}-[A-Z0-9]{4}$/);
      expect(contract.status).toBe('pending_signature');
      expect(contract.slaUptimePercent).toBe(99.9);
      expect(contract.mcuCapacityMonthly).toBe(250_000);
      expect(contract.volumeDiscountPercent).toBe(0.45);
      expect(contract.unitPricePerMcuCents).toBe(2.75);
      expect(contract.monthlyCommitmentCents).toBe(687_500);
      expect(contract.termsVersion).toBe('2026.1-ENTERPRISE-SLA');
      expect(contract.contractSha256).toMatch(/^[a-f0-9]{64}$/);

      // Verify original quote status transitioned to accepted
      const updatedQuote = await getQuoteById(db, quote.id);
      expect(updatedQuote?.status).toBe('accepted');
    });

    it('rejects conversion if quote is declined or expired', async () => {
      const quote = await createEnterpriseQuote(db, {
        orgId: 'org_globex',
        mcuCapacityMonthly: 50_000,
      });

      // Manually set status to declined
      await db.prepare("UPDATE enterprise_quotes SET status = 'declined' WHERE id = ?").bind(quote.id).run();

      await expect(convertQuoteToContract(db, quote.id)).rejects.toThrow(/Cannot convert quote with status 'declined'/);
    });
  });

  describe('executeContractSigning', () => {
    it('signs contract with customer signature and automated platform counter-signature', async () => {
      const quote = await createEnterpriseQuote(db, {
        orgId: 'org_globex',
        mcuCapacityMonthly: 100_000,
        billingCycle: 'monthly',
      });
      const contract = await convertQuoteToContract(db, quote.id);

      const signed = await executeContractSigning(db, contract.id, {
        signerName: 'Alex Mercer',
        signerEmail: 'alex@globex.com',
        signerTitle: 'VP Infrastructure',
        signerIp: '203.0.113.42',
        signingSecret: 'globex-secret-signing-key',
      });

      expect(signed.status).toBe('signed');
      expect(signed.customerSignerName).toBe('Alex Mercer');
      expect(signed.customerSignerEmail).toBe('alex@globex.com');
      expect(signed.customerSignerTitle).toBe('VP Infrastructure');
      expect(signed.customerSignerIp).toBe('203.0.113.42');
      expect(signed.customerSignatureHash).toMatch(/^[a-f0-9]{64}$/);
      expect(signed.customerSignedAt).toBeGreaterThan(0);
      expect(signed.platformSignatureHash).toMatch(/^[a-f0-9]{64}$/);
      expect(signed.platformSignedAt).toBeGreaterThan(0);

      // Verify contract in DB
      const dbContract = await getContractById(db, contract.id);
      expect(dbContract?.status).toBe('signed');
      expect(dbContract?.customerSignatureHash).toBe(signed.customerSignatureHash);
    });
  });

  describe('initiateContractPayment', () => {
    it('initiates NOWPayments USDT checkout with priceAmountOverride', async () => {
      const quote = await createEnterpriseQuote(db, {
        orgId: 'org_globex',
        mcuCapacityMonthly: 100_000,
        billingCycle: 'monthly',
      });
      const contract = await convertQuoteToContract(db, quote.id);
      await executeContractSigning(db, contract.id, {
        signerName: 'Alex Mercer',
        signerEmail: 'alex@globex.com',
        signerTitle: 'VP Infrastructure',
      });

      const payment = await initiateContractPayment(db, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        userId: 'usr_globex_admin',
      });

      expect(payment.paymentRail).toBe('NOWPAYMENTS');
      expect(payment.amountCents).toBe(350_000);
      expect(payment.checkoutUrl).toBe('https://nowpayments.io/payment/?iid=nowp_inv_123');
      expect(mockCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          tierId: 'ENTERPRISE',
          userId: 'usr_globex_admin',
          priceAmountOverride: 3500, // $3,500
        }),
      );

      // Verify invoice was created in invoices table
      const updatedContract = await getContractById(db, contract.id);
      expect(updatedContract?.lastInvoiceId).toBe(payment.invoiceId);
      expect(updatedContract?.paymentRail).toBe('NOWPAYMENTS');
    });

    it('initiates PayOS VietQR checkout with amountVndOverride', async () => {
      const quote = await createEnterpriseQuote(db, {
        orgId: 'org_globex',
        mcuCapacityMonthly: 50_000,
        billingCycle: 'monthly',
      });
      const contract = await convertQuoteToContract(db, quote.id);
      await executeContractSigning(db, contract.id, {
        signerName: 'Alex Mercer',
        signerEmail: 'alex@globex.com',
        signerTitle: 'VP Infrastructure',
      });

      const payment = await initiateContractPayment(db, {
        contractId: contract.id,
        paymentRail: 'PAYOS',
        userId: 'usr_globex_admin',
      });

      expect(payment.paymentRail).toBe('PAYOS');
      expect(payment.amountCents).toBe(200_000); // $2,000
      expect(payment.checkoutUrl).toBe('https://payos.vn/gate/payos_order_123');
      expect(payment.qrUrl).toBe('https://img.vietqr.io/image/970422-0000-compact2.png');
      expect(mockPayOsInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'ENTERPRISE',
          userId: 'usr_globex_admin',
          amountVndOverride: expect.any(Number),
        }),
      );
    });

    it('throws if attempting payment on unsigned contract', async () => {
      const quote = await createEnterpriseQuote(db, {
        orgId: 'org_globex',
        mcuCapacityMonthly: 50_000,
      });
      const contract = await convertQuoteToContract(db, quote.id);

      await expect(
        initiateContractPayment(db, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          userId: 'usr_1',
        }),
      ).rejects.toThrow(/Contract must be signed before initiating payment/);
    });
  });

  describe('fulfillContractPayment', () => {
    it('fulfills payment: marks invoice paid, provisions MCU balance, activates contract, closes deal', async () => {
      const quote = await createEnterpriseQuote(db, {
        orgId: 'org_globex',
        mcuCapacityMonthly: 100_000,
        billingCycle: 'monthly',
        dealId: 'deal_globex_1',
      });
      const contract = await convertQuoteToContract(db, quote.id);
      await executeContractSigning(db, contract.id, {
        signerName: 'Alex Mercer',
        signerEmail: 'alex@globex.com',
        signerTitle: 'VP Infrastructure',
      });
      const payment = await initiateContractPayment(db, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        userId: 'usr_globex_admin',
      });

      // Fulfill payment
      const result = await fulfillContractPayment(db, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        paymentReference: 'nowp_tx_999888',
        paidByUserId: 'usr_globex_admin',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('active');
      expect(result.creditsProvisioned).toBe(100_000);
      expect(result.invoiceId).toBe(payment.invoiceId);

      // Verify contract status is now active
      const activeContract = await getContractById(db, contract.id);
      expect(activeContract?.status).toBe('active');
      expect(activeContract?.paymentRail).toBe('NOWPAYMENTS');

      // Verify MCU credits provisioned in user_mcu_balance
      const balanceRow = await db
        .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?')
        .bind('usr_globex_admin')
        .first<{ credits_remaining: number }>();
      expect(balanceRow?.credits_remaining).toBe(100_000);

      // Verify E-Invoice status is paid
      const invoiceRow = await db
        .prepare('SELECT status, paid_at FROM invoices WHERE id = ?')
        .bind(payment.invoiceId)
        .first<{ status: string; paid_at: number }>();
      expect(invoiceRow?.status).toBe('paid');
      expect(invoiceRow?.paid_at).toBeGreaterThan(0);

      // Verify enterprise deal updated to closed_won
      const dealRow = await db
        .prepare('SELECT deal_stage FROM enterprise_deals WHERE id = ?')
        .bind('deal_globex_1')
        .first<{ deal_stage: string }>();
      expect(dealRow?.deal_stage).toBe('closed_won');
    });

    it('enforces idempotency: does not double-provision credits on duplicate webhook calls', async () => {
      const quote = await createEnterpriseQuote(db, {
        orgId: 'org_globex',
        mcuCapacityMonthly: 50_000,
        billingCycle: 'monthly',
      });
      const contract = await convertQuoteToContract(db, quote.id);
      await executeContractSigning(db, contract.id, {
        signerName: 'Alex Mercer',
        signerEmail: 'alex@globex.com',
        signerTitle: 'VP Infrastructure',
      });
      await initiateContractPayment(db, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        userId: 'usr_idempotent_test',
      });

      // First fulfillment
      await fulfillContractPayment(db, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        paymentReference: 'tx_first',
        paidByUserId: 'usr_idempotent_test',
      });

      const initialBalance = await db
        .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?')
        .bind('usr_idempotent_test')
        .first<{ credits_remaining: number }>();
      expect(initialBalance?.credits_remaining).toBe(50_000);

      // Duplicate fulfillment
      const dupResult = await fulfillContractPayment(db, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        paymentReference: 'tx_duplicate',
        paidByUserId: 'usr_idempotent_test',
      });

      expect(dupResult.success).toBe(true);
      expect(dupResult.status).toBe('active');

      const finalBalance = await db
        .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?')
        .bind('usr_idempotent_test')
        .first<{ credits_remaining: number }>();
      // Must NOT be 100,000! Exactly 50,000 preserved.
      expect(finalBalance?.credits_remaining).toBe(50_000);
    });
  });
});
