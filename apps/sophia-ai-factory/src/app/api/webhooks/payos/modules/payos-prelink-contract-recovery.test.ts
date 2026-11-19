import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { D1Client } from '@/seed/db/client';
import {
  isPreLinkPayOsContractIntent,
  matchesPayOsIdentity,
  validatePayOsPaymentIdentity,
} from './payos-payment-identity';
import { fulfillPayOsContractOrder } from '@/land/contracts/workflow/payos-contract-fulfillment';
import type { D1Database } from '@cloudflare/workers-types';

const basePreLinkContractOrder: PendingOrder = {
  order_id: 'contract_ord_1',
  user_id: 'user-tenant-a',
  tier: 'ENTERPRISE',
  period: 'yearly',
  payment_method: 'payos',
  amount_usd_cents: 120000,
  amount_vnd: 30000000,
  promo_code: null,
  customer_email: 'ceo@tenanta.com',
  invoice_url: null,
  provider_payment_id: null,
  provider_order_code: 987654321,
  purpose: 'contract',
  contract_id: 'contract-a',
  invoice_id: 'invoice-a',
  status: 'pending',
  payment_id: null,
  created_at: '2026-11-19T00:00:00.000Z',
  completed_at: null,
};

function makeOrderLookupDb(rows: PendingOrder[]): D1Client {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    then: vi.fn((resolve: (v: unknown) => void) => resolve({ data: rows, error: null })),
  };
  return { from: vi.fn(() => query) } as unknown as D1Client;
}

describe('G2: PayOS pre-link contract recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a valid pre-link pending PayOS contract intent with matching orderCode, VND currency, and exact amount', async () => {
    expect(isPreLinkPayOsContractIntent(basePreLinkContractOrder)).toBe(true);
    expect(matchesPayOsIdentity(basePreLinkContractOrder, 987654321, 'payos_link_recovered_1')).toBe(true);

    const db = makeOrderLookupDb([basePreLinkContractOrder]);
    const result = await validatePayOsPaymentIdentity({
      db,
      orderCode: 987654321,
      paymentLinkId: 'payos_link_recovered_1',
      amount: 30000000,
      currency: 'VND',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.order_id).toBe('contract_ord_1');
      expect(result.expectedVndAmount).toBe(30000000);
    }
  });

  it('rejects subscription/legacy orders with NULL provider_payment_id and NULL invoice_url (no blind NULL acceptance)', async () => {
    const subscriptionOrder: PendingOrder = {
      ...basePreLinkContractOrder,
      order_id: 'sub_ord_1',
      purpose: 'subscription',
      contract_id: null,
      invoice_id: null,
    };

    expect(isPreLinkPayOsContractIntent(subscriptionOrder)).toBe(false);
    expect(matchesPayOsIdentity(subscriptionOrder, 987654321, 'payos_link_sub')).toBe(false);

    const db = makeOrderLookupDb([subscriptionOrder]);
    const result = await validatePayOsPaymentIdentity({
      db,
      orderCode: 987654321,
      paymentLinkId: 'payos_link_sub',
      amount: 30000000,
      currency: 'VND',
    });
    expect(result).toEqual({ ok: false, error: 'Payment identity mismatch', status: 400 });
  });

  it('rejects already-linked contract orders when paymentLinkId mismatches stored provider_payment_id or invoice_url', async () => {
    const linkedById: PendingOrder = {
      ...basePreLinkContractOrder,
      provider_payment_id: 'payos_link_original',
    };
    expect(matchesPayOsIdentity(linkedById, 987654321, 'payos_link_spoofed')).toBe(false);
    expect(matchesPayOsIdentity(linkedById, 987654321, 'payos_link_original')).toBe(true);

    const linkedByUrl: PendingOrder = {
      ...basePreLinkContractOrder,
      invoice_url: 'https://pay.payos.vn/web/payos_link_original',
    };
    expect(matchesPayOsIdentity(linkedByUrl, 987654321, 'payos_link_spoofed')).toBe(false);
    expect(matchesPayOsIdentity(linkedByUrl, 987654321, 'payos_link_original')).toBe(true);
  });

  it('rejects completed/failed contract orders when provider_payment_id and invoice_url are NULL', () => {
    const completedUnlinked: PendingOrder = { ...basePreLinkContractOrder, status: 'completed' };
    const failedUnlinked: PendingOrder = { ...basePreLinkContractOrder, status: 'failed' };
    expect(isPreLinkPayOsContractIntent(completedUnlinked)).toBe(false);
    expect(isPreLinkPayOsContractIntent(failedUnlinked)).toBe(false);
    expect(matchesPayOsIdentity(completedUnlinked, 987654321, 'payos_link_1')).toBe(false);
  });

  it('rejects wrong amount, wrong currency, or incomplete contract intent fields', async () => {
    const db = makeOrderLookupDb([basePreLinkContractOrder]);

    const wrongAmount = await validatePayOsPaymentIdentity({
      db,
      orderCode: 987654321,
      paymentLinkId: 'payos_link_1',
      amount: 29999999,
      currency: 'VND',
    });
    expect(wrongAmount).toEqual({ ok: false, error: 'Amount mismatch', status: 400 });

    const wrongCurrency = await validatePayOsPaymentIdentity({
      db,
      orderCode: 987654321,
      paymentLinkId: 'payos_link_1',
      amount: 30000000,
      currency: 'USD',
    });
    expect(wrongCurrency).toEqual({ ok: false, error: 'Invalid amount or currency', status: 400 });

    const missingContractId: PendingOrder = { ...basePreLinkContractOrder, contract_id: null };
    expect(isPreLinkPayOsContractIntent(missingContractId)).toBe(false);
  });

  it('settles a pre-link contract order atomically in SQLite D1, binds provider_payment_id, and blocks concurrent/duplicate double-credit', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE payment_events (event_id TEXT PRIMARY KEY, processed INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE pending_orders (
        order_id TEXT PRIMARY KEY, user_id TEXT, tier TEXT, period TEXT, payment_method TEXT,
        amount_usd_cents INTEGER, amount_vnd INTEGER, provider_payment_id TEXT, provider_order_code INTEGER,
        invoice_url TEXT, purpose TEXT, contract_id TEXT, invoice_id TEXT, status TEXT, payment_id TEXT, completed_at TEXT
      );
      CREATE TABLE enterprise_contracts (id TEXT PRIMARY KEY, org_id TEXT, last_invoice_id TEXT, payment_rail TEXT, status TEXT, updated_at INTEGER);
      CREATE TABLE invoices (id TEXT PRIMARY KEY, org_id TEXT, currency TEXT, total_amount_cents INTEGER, status TEXT, paid_at INTEGER, updated_at INTEGER);
      CREATE TABLE mcu_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, delta INTEGER, reason TEXT, metadata TEXT, payment_reference TEXT UNIQUE);
      CREATE TABLE user_mcu_balance (user_id TEXT PRIMARY KEY, credits_remaining INTEGER, credits_total_purchased INTEGER, updated_at INTEGER);
    `);

    const lockA = '2026-11-19T01:00:00.000Z';
    const lockB = '2026-11-19T01:00:01.000Z';
    sqlite.prepare(`INSERT INTO payment_events VALUES ('payos_link_A', 0, ?)`).run(lockA);
    sqlite.prepare(`INSERT INTO payment_events VALUES ('payos_link_B', 0, ?)`).run(lockB);
    sqlite.prepare(`INSERT INTO pending_orders (order_id, user_id, tier, period, payment_method, amount_usd_cents, amount_vnd, provider_payment_id, provider_order_code, invoice_url, purpose, contract_id, invoice_id, status)
      VALUES ('contract_ord_1', 'user-tenant-a', 'ENTERPRISE', 'annual', 'payos', 120000, 30000000, NULL, 987654321, NULL, 'contract', 'contract-a', 'invoice-a', 'pending')`).run();
    sqlite.prepare(`INSERT INTO enterprise_contracts VALUES ('contract-a', 'org-a', 'invoice-a', 'PAYOS', 'signed', 100)`).run();
    sqlite.prepare(`INSERT INTO invoices VALUES ('invoice-a', 'org-a', 'VND', 30000000, 'issued', NULL, 100)`).run();

    const d1 = {
      prepare(sql: string) {
        let params: unknown[] = [];
        const stmt = {
          bind(...args: unknown[]) { params = args; return stmt; },
          _exec() {
            const res = sqlite.prepare(sql).run(...(params as never[]));
            return { success: true, meta: { changes: Number(res.changes ?? 0) } };
          },
        };
        return stmt;
      },
      async batch(stmts: Array<{ _exec(): { success: boolean; meta: { changes: number } } }>) {
        sqlite.exec('BEGIN');
        try {
          const out = stmts.map((s) => s._exec());
          sqlite.exec('COMMIT');
          return out;
        } catch (err) {
          sqlite.exec('ROLLBACK');
          throw err;
        }
      },
    } as unknown as D1Database;

    const contract = {
      id: 'contract-a',
      orgId: 'org-a',
      lastInvoiceId: 'invoice-a',
      status: 'signed',
      mcuCapacityMonthly: 5000,
    } as Parameters<typeof fulfillPayOsContractOrder>[1]['contract'];

    // First valid IPN settles the pre-link intent and binds provider_payment_id = 'link_A'
    await fulfillPayOsContractOrder(d1, {
      contract,
      invoiceId: 'invoice-a',
      orderId: 'contract_ord_1',
      paidByUserId: 'user-tenant-a',
      paymentReference: 'link_A',
      providerOrderCode: 987654321,
      amountVnd: 30000000,
      lockCreatedAt: lockA,
    });

    const settledOrder = sqlite.prepare(`SELECT status, provider_payment_id FROM pending_orders WHERE order_id = 'contract_ord_1'`).get() as { status: string; provider_payment_id: string };
    expect(settledOrder).toEqual({ status: 'completed', provider_payment_id: 'link_A' });

    const balanceAfterFirst = sqlite.prepare(`SELECT credits_remaining FROM user_mcu_balance WHERE user_id = 'user-tenant-a'`).get() as { credits_remaining: number };
    expect(balanceAfterFirst.credits_remaining).toBe(5000);

    // Racing second IPN with a different paymentLinkId MUST fail and roll back (0 double-credit)
    await expect(
      fulfillPayOsContractOrder(d1, {
        contract,
        invoiceId: 'invoice-a',
        orderId: 'contract_ord_1',
        paidByUserId: 'user-tenant-a',
        paymentReference: 'link_B',
        providerOrderCode: 987654321,
        amountVnd: 30000000,
        lockCreatedAt: lockB,
      }),
    ).rejects.toThrow();

    const balanceAfterRace = sqlite.prepare(`SELECT credits_remaining FROM user_mcu_balance WHERE user_id = 'user-tenant-a'`).get() as { credits_remaining: number };
    expect(balanceAfterRace.credits_remaining).toBe(5000);
    sqlite.close();
  });
});
