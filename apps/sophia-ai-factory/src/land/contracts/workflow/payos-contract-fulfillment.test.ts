/**
 * PayOS contract fulfillment integration tests. Runs against an in-memory SQLite
 * database, which requires the Node environment.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import type { EnterpriseContract } from '@/seed/types/enterprise-contracts';
import { fulfillPayOsContractOrder } from './payos-contract-fulfillment';

function createDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`
    CREATE TABLE payment_events (event_id TEXT PRIMARY KEY, processed INTEGER, created_at TEXT);
    CREATE TABLE pending_orders (
      order_id TEXT PRIMARY KEY, user_id TEXT, provider_payment_id TEXT, provider_order_code INTEGER,
      status TEXT, payment_method TEXT, purpose TEXT, contract_id TEXT, invoice_id TEXT,
      amount_vnd INTEGER, payment_id TEXT, completed_at TEXT
    );
    CREATE TABLE enterprise_contracts (
      id TEXT PRIMARY KEY, org_id TEXT, last_invoice_id TEXT, status TEXT, payment_rail TEXT,
      mcu_capacity_monthly INTEGER, deal_id TEXT, updated_at INTEGER
    );
    CREATE TABLE invoices (
      id TEXT PRIMARY KEY, org_id TEXT, currency TEXT, total_amount_cents INTEGER,
      status TEXT, paid_at INTEGER, updated_at INTEGER
    );
    CREATE TABLE mcu_transactions (
      id INTEGER PRIMARY KEY, user_id TEXT, delta INTEGER, reason TEXT, metadata TEXT,
      payment_reference TEXT UNIQUE, created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE user_mcu_balance (
      user_id TEXT PRIMARY KEY, credits_remaining INTEGER, credits_total_purchased INTEGER, updated_at INTEGER
    );
    CREATE TABLE enterprise_deals (id TEXT PRIMARY KEY, deal_stage TEXT, updated_at INTEGER);
    CREATE TABLE organizations (id TEXT PRIMARY KEY, plan TEXT);
    CREATE TABLE subscriptions (org_id TEXT, tier TEXT, status TEXT);
    INSERT INTO organizations VALUES ('org-1', 'basic');
    INSERT INTO subscriptions VALUES ('org-1', 'BASIC', 'active');
    INSERT INTO enterprise_contracts VALUES ('contract-1', 'org-1', 'invoice-1', 'signed', NULL, 50000, 'deal-1', 1);
    INSERT INTO invoices VALUES ('invoice-1', 'org-1', 'VND', 5250000, 'draft', NULL, 1);
    INSERT INTO enterprise_deals VALUES ('deal-1', 'negotiation', 1);
    INSERT INTO payment_events VALUES ('payos_link-1', 0, 'lock-1');
    INSERT INTO pending_orders VALUES ('order-1', 'user-1', NULL, 12345, 'pending', 'payos', 'contract', 'contract-1', 'invoice-1', 5250000, NULL, NULL);
  `);

  const wrap = (sql: string) => {
    const statement = raw.prepare(sql);
    let values: unknown[] = [];
    return {
      bind(...args: unknown[]) { values = args; return this; },
      async run() {
        const result = statement.run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  };
  const d1 = {
    prepare: wrap,
    async batch(statements: Array<{ run: () => Promise<{ success: boolean; meta: { changes: number } }> }>) {
      raw.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        raw.exec('COMMIT');
        return results;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as D1Database;
  return { raw, d1 };
}

const contract = {
  id: 'contract-1', orgId: 'org-1', lastInvoiceId: 'invoice-1', status: 'signed',
  mcuCapacityMonthly: 50000, dealId: 'deal-1',
} as EnterpriseContract;

const input = {
  contract, invoiceId: 'invoice-1', orderId: 'order-1', paidByUserId: 'user-1',
  paymentReference: 'link-1', providerOrderCode: 12345, amountVnd: 5250000,
  lockCreatedAt: 'lock-1',
};

describe('fulfillPayOsContractOrder', () => {
  it('activates the contract and grants one MCU credit ledger entry without changing SaaS tier', async () => {
    const { raw, d1 } = createDb();
    await fulfillPayOsContractOrder(d1, input);

    expect(raw.prepare("SELECT status FROM enterprise_contracts WHERE id = 'contract-1'").get()).toEqual({ status: 'active' });
    expect(raw.prepare("SELECT status FROM invoices WHERE id = 'invoice-1'").get()).toEqual({ status: 'paid' });
    expect(raw.prepare("SELECT status FROM pending_orders WHERE order_id = 'order-1'").get()).toEqual({ status: 'completed' });
    expect(raw.prepare("SELECT provider_payment_id FROM pending_orders WHERE order_id = 'order-1'").get()).toEqual({ provider_payment_id: 'link-1' });
    expect(raw.prepare("SELECT COUNT(*) AS count FROM mcu_transactions WHERE payment_reference = 'link-1'").get()).toEqual({ count: 1 });
    expect(raw.prepare("SELECT credits_remaining FROM user_mcu_balance WHERE user_id = 'user-1'").get()).toEqual({ credits_remaining: 50000 });
    expect(raw.prepare("SELECT plan FROM organizations WHERE id = 'org-1'").get()).toEqual({ plan: 'basic' });
    expect(raw.prepare("SELECT tier FROM subscriptions WHERE org_id = 'org-1'").get()).toEqual({ tier: 'BASIC' });
    expect(raw.prepare("SELECT processed FROM payment_events WHERE event_id = 'payos_link-1'").get()).toEqual({ processed: 1 });
  });

  it('allows a later invoice for the same active contract to provision a separate period once', async () => {
    const { raw, d1 } = createDb();
    await fulfillPayOsContractOrder(d1, input);
    raw.exec(`UPDATE enterprise_contracts SET last_invoice_id='invoice-2' WHERE id='contract-1';
      INSERT INTO invoices VALUES ('invoice-2','org-1','VND',5250000,'draft',NULL,1);
      INSERT INTO payment_events VALUES ('payos_link-2',0,'lock-2');
      INSERT INTO pending_orders VALUES ('order-2','user-1','link-2',12346,'pending','payos','contract','contract-1','invoice-2',5250000,NULL,NULL);`);

    await fulfillPayOsContractOrder(d1, {
      ...input, invoiceId: 'invoice-2', orderId: 'order-2', paymentReference: 'link-2',
      providerOrderCode: 12346, lockCreatedAt: 'lock-2',
    });

    expect(raw.prepare("SELECT credits_remaining FROM user_mcu_balance WHERE user_id = 'user-1'").get()).toEqual({ credits_remaining: 100000 });
    expect(raw.prepare('SELECT COUNT(*) AS count FROM mcu_transactions').get()).toEqual({ count: 2 });
  });

  it('rolls every fulfillment write back when a required invoice update fails', async () => {
    const { raw, d1 } = createDb();
    raw.exec(`CREATE TRIGGER fail_invoice_update BEFORE UPDATE ON invoices
      BEGIN SELECT RAISE(ABORT, 'injected invoice failure'); END;`);

    await expect(fulfillPayOsContractOrder(d1, input)).rejects.toThrow('injected invoice failure');
    expect(raw.prepare("SELECT status FROM enterprise_contracts WHERE id = 'contract-1'").get()).toEqual({ status: 'signed' });
    expect(raw.prepare("SELECT processed FROM payment_events WHERE event_id = 'payos_link-1'").get()).toEqual({ processed: 0 });
    expect(raw.prepare('SELECT COUNT(*) AS count FROM mcu_transactions').get()).toEqual({ count: 0 });
  });
});
