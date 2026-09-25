/**
 * Unit Test Suite: Enterprise Contract Server Actions
 *
 * Verifies RBAC auth guards, platform admin bypass, organization membership validation,
 * and error handling for enterprise contract server actions.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import type { User } from '@/seed/db/client';

let mockCurrentUser: User | null = null;
let mockIsAdmin = false;
let mockD1Instance: D1Database;

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => Promise.resolve(mockCurrentUser),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdminWithRole: () => Promise.resolve({ isAdmin: mockIsAdmin, dbRole: mockIsAdmin ? 'admin' : 'user' }),
  isUserAdmin: () => Promise.resolve(mockIsAdmin),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: () => Promise.resolve(mockD1Instance),
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { role: mockIsAdmin ? 'admin' : 'user' } }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/tree/clients/nowpayments-client', () => ({
  createCheckout: vi.fn().mockResolvedValue({
    invoiceUrl: 'https://nowpayments.io/payment/?iid=nowp_inv_123',
    orderId: 'sophia_contract_order_123',
    invoiceId: 'nowp_inv_123',
  }),
}));

vi.mock('@/land/payments/payos', () => ({
  createPayOsInvoice: vi.fn().mockResolvedValue({
    checkoutUrl: 'https://payos.vn/gate/payos_order_123',
    qrUrl: 'https://img.vietqr.io/image/970422-0000-compact2.png',
    paymentLinkId: 'link_123',
    orderCode: 123456789,
    expiresAt: '2026-10-01T00:00:00Z',
  }),
}));

import {
  generateEnterpriseQuoteAction,
  getEnterpriseQuoteAction,
  convertQuoteToContractAction,
  getEnterpriseContractAction,
  signEnterpriseContractAction,
  initiateEnterprisePaymentAction,
  fulfillEnterprisePaymentAction,
  getContractTermsDocumentAction,
} from '@/land/contracts/enterprise-contract-actions';

function setupActionDatabase(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS org_members (
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      PRIMARY KEY (org_id, user_id)
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

    INSERT INTO organizations (id, name) VALUES ('org_acme', 'Acme Corp');
    INSERT INTO org_members (org_id, user_id, role) VALUES ('org_acme', 'usr_admin', 'owner');
    INSERT INTO org_members (org_id, user_id, role) VALUES ('org_acme', 'usr_viewer', 'reviewer');
  `);

  const d1 = {
    raw: db,
    prepare(sql: string) {
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

describe('Enterprise Contract Server Actions', () => {
  let db: D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    db = setupActionDatabase();
    mockD1Instance = db;
    mockCurrentUser = {
      id: 'usr_admin',
      email: 'admin@acme.com',
      full_name: 'Admin User',
      role: 'user',
    };
    mockIsAdmin = false;
  });

  describe('RBAC Authorization Guards', () => {
    it('returns UNAUTHORIZED when no user session exists', async () => {
      mockCurrentUser = null;
      const res = await generateEnterpriseQuoteAction({
        orgId: 'org_acme',
        mcuCapacityMonthly: 100_000,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns FORBIDDEN when user does not belong to the organization', async () => {
      mockCurrentUser = {
        id: 'usr_outsider',
        email: 'outsider@other.com',
        full_name: 'Outsider',
        role: 'user',
      };
      const res = await generateEnterpriseQuoteAction({
        orgId: 'org_acme',
        mcuCapacityMonthly: 100_000,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns FORBIDDEN when member role lacks billing permission', async () => {
      mockCurrentUser = {
        id: 'usr_viewer',
        email: 'viewer@acme.com',
        full_name: 'Viewer',
        role: 'user',
      };
      const res = await generateEnterpriseQuoteAction({
        orgId: 'org_acme',
        mcuCapacityMonthly: 100_000,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
        expect(res.error.message).toContain('lacks permission');
      }
    });

    it('grants access to platform admin regardless of org membership', async () => {
      mockCurrentUser = {
        id: 'usr_superadmin',
        email: 'super@sophia.network',
        full_name: 'Super Admin',
        role: 'admin',
      };
      mockIsAdmin = true;

      const res = await generateEnterpriseQuoteAction({
        orgId: 'org_acme',
        mcuCapacityMonthly: 100_000,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.orgId).toBe('org_acme');
      }
    });
  });

  describe('Full Server Action Workflow Execution', () => {
    it('executes quote creation, retrieval, contract conversion, signing, payment, and terms doc retrieval', async () => {
      // 1. Generate Quote
      const quoteRes = await generateEnterpriseQuoteAction({
        orgId: 'org_acme',
        mcuCapacityMonthly: 100_000,
        billingCycle: 'monthly',
      });
      expect(quoteRes.ok).toBe(true);
      if (!quoteRes.ok) return;
      const quote = quoteRes.value;

      // 2. Get Quote
      const getQuoteRes = await getEnterpriseQuoteAction(quote.id);
      expect(getQuoteRes.ok).toBe(true);

      // 3. Convert Quote to Contract
      const contractRes = await convertQuoteToContractAction(quote.id);
      expect(contractRes.ok).toBe(true);
      if (!contractRes.ok) return;
      const contract = contractRes.value;
      expect(contract.status).toBe('pending_signature');

      // 4. Get Contract
      const getContractRes = await getEnterpriseContractAction(contract.id);
      expect(getContractRes.ok).toBe(true);

      // 5. Sign Contract
      const signRes = await signEnterpriseContractAction(contract.id, {
        signerName: 'Jane Smith',
        signerEmail: 'jane@acme.com',
        signerTitle: 'Chief Executive Officer',
      });
      expect(signRes.ok).toBe(true);
      if (!signRes.ok) return;
      expect(signRes.value.status).toBe('signed');

      // 6. Initiate Payment
      const payRes = await initiateEnterprisePaymentAction(contract.id, 'NOWPAYMENTS');
      expect(payRes.ok).toBe(true);
      if (!payRes.ok) return;
      expect(payRes.value.paymentRail).toBe('NOWPAYMENTS');
      expect(payRes.value.checkoutUrl).toBeDefined();

      // 7. Get Terms Document
      const termsRes = await getContractTermsDocumentAction(contract.id, 'vi');
      expect(termsRes.ok).toBe(true);
      if (!termsRes.ok) return;
      expect(termsRes.value.termsMarkdown).toContain('HỢP ĐỒNG DỊCH VỤ ĐIỆN TOÁN DOANH NGHIỆP');
      expect(termsRes.value.termsHtml).toContain('<!DOCTYPE html>');

      // 8. Fulfill Payment as admin
      mockIsAdmin = true;
      mockCurrentUser = {
        id: 'usr_admin',
        email: 'admin@sophia.network',
        role: 'admin',
      };
      const fulfillRes = await fulfillEnterprisePaymentAction(contract.id, 'NOWPAYMENTS', 'tx_action_test');
      expect(fulfillRes.ok).toBe(true);
      if (!fulfillRes.ok) return;
      expect(fulfillRes.value.status).toBe('active');
    });

    it('denies fulfillment to non-admin users', async () => {
      // User is non-admin owner
      mockIsAdmin = false;
      mockCurrentUser = {
        id: 'usr_admin',
        email: 'admin@acme.com',
        role: 'user',
      };

      const res = await fulfillEnterprisePaymentAction('ec_dummy', 'NOWPAYMENTS', 'tx_test');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
    });
  });
});
