import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import type { EnterpriseContract } from '@/seed/types/enterprise-contracts';
import { fulfillNowPaymentsContractOrder } from './nowpayments-contract-fulfillment';
import { refundNowPaymentsContractOrder } from './nowpayments-contract-refund';

function fixture() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`
    CREATE TABLE payment_events (event_id TEXT PRIMARY KEY, processed INTEGER, created_at TEXT);
    CREATE TABLE pending_orders (order_id TEXT PRIMARY KEY, user_id TEXT, provider_payment_id TEXT,
      status TEXT, payment_method TEXT, purpose TEXT, contract_id TEXT, invoice_id TEXT,
      amount_usd_cents INTEGER, payment_id TEXT, completed_at TEXT);
    CREATE TABLE enterprise_contracts (id TEXT PRIMARY KEY, org_id TEXT, last_invoice_id TEXT,
      status TEXT, payment_rail TEXT, mcu_capacity_monthly INTEGER, deal_id TEXT, updated_at INTEGER);
    CREATE TABLE invoices (id TEXT PRIMARY KEY, org_id TEXT, currency TEXT, total_amount_cents INTEGER,
      status TEXT, paid_at INTEGER, updated_at INTEGER);
    CREATE TABLE mcu_transactions (id INTEGER PRIMARY KEY, user_id TEXT, delta INTEGER, reason TEXT,
      metadata TEXT, payment_reference TEXT UNIQUE, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE user_mcu_balance (user_id TEXT PRIMARY KEY, credits_remaining INTEGER,
      credits_total_purchased INTEGER, updated_at INTEGER);
    CREATE TABLE enterprise_deals (id TEXT PRIMARY KEY, deal_stage TEXT, updated_at INTEGER);
    INSERT INTO payment_events VALUES ('nowpayments_payment-1_finished', 0, 'lock-1');
    INSERT INTO payment_events VALUES ('nowpayments_payment-1_refunded', 0, 'refund-lock-1');
    INSERT INTO pending_orders VALUES ('order-1','user-1','provider-invoice-1','pending','nowpayments',
      'contract','contract-1','invoice-1',350000,NULL,NULL);
    INSERT INTO enterprise_contracts VALUES ('contract-1','org-1','invoice-1','signed',NULL,50000,'deal-1',1);
    INSERT INTO invoices VALUES ('invoice-1','org-1','USD',350000,'draft',NULL,1);
    INSERT INTO enterprise_deals VALUES ('deal-1','negotiation',1);
  `);
  const wrap = (sql: string) => {
    const statement = raw.prepare(sql); let values: unknown[] = [];
    return { bind(...args: unknown[]) { values = args; return this; }, async run() {
      const result = statement.run(...values);
      return { success: true, meta: { changes: Number(result.changes) } };
    } };
  };
  const d1 = {
    prepare: wrap,
    async batch(statements: Array<{ run: () => Promise<{ success: boolean; meta: { changes: number } }> }>) {
      raw.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); raw.exec('COMMIT'); return results; }
      catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  } as unknown as D1Database;
  return { raw, d1 };
}

const input = {
  contract: { id: 'contract-1', orgId: 'org-1', lastInvoiceId: 'invoice-1', status: 'signed',
    mcuCapacityMonthly: 50000, dealId: 'deal-1' } as EnterpriseContract,
  invoiceId: 'invoice-1', orderId: 'order-1', paidByUserId: 'user-1', paymentId: 'payment-1',
  providerInvoiceId: 'provider-invoice-1', amountCents: 350000, lockCreatedAt: 'lock-1',
};

describe('fulfillNowPaymentsContractOrder', () => {
  it('settles the invoice and provisions one contract credit entry atomically', async () => {
    const { raw, d1 } = fixture();
    await fulfillNowPaymentsContractOrder(d1, input);
    expect(raw.prepare("SELECT status FROM invoices WHERE id='invoice-1'").get()).toEqual({ status: 'paid' });
    expect(raw.prepare("SELECT status FROM pending_orders WHERE order_id='order-1'").get()).toEqual({ status: 'completed' });
    expect(raw.prepare("SELECT payment_rail FROM enterprise_contracts WHERE id='contract-1'").get()).toEqual({ payment_rail: 'NOWPAYMENTS' });
    expect(raw.prepare("SELECT credits_remaining FROM user_mcu_balance WHERE user_id='user-1'").get()).toEqual({ credits_remaining: 50000 });
    expect(raw.prepare("SELECT processed FROM payment_events WHERE event_id='nowpayments_payment-1_finished'").get()).toEqual({ processed: 1 });
  });

  it('recovers a missing provider invoice link from the signed, correlated IPN', async () => {
    const { raw, d1 } = fixture();
    raw.prepare("UPDATE pending_orders SET provider_payment_id = NULL WHERE order_id='order-1'").run();

    await fulfillNowPaymentsContractOrder(d1, input);

    expect(raw.prepare("SELECT provider_payment_id, payment_id, status FROM pending_orders WHERE order_id='order-1'").get())
      .toEqual({ provider_payment_id: 'provider-invoice-1', payment_id: 'payment-1', status: 'completed' });
    expect(raw.prepare("SELECT credits_remaining FROM user_mcu_balance WHERE user_id='user-1'").get())
      .toEqual({ credits_remaining: 50000 });
  });

  it.each(['expired', 'failed'] as const)('allows a verified late payment to settle a %s order', async (status) => {
    const { raw, d1 } = fixture();
    raw.prepare('UPDATE pending_orders SET status = ? WHERE order_id = ?').run(status, 'order-1');

    await fulfillNowPaymentsContractOrder(d1, input);

    expect(raw.prepare("SELECT status FROM pending_orders WHERE order_id='order-1'").get()).toEqual({ status: 'completed' });
    expect(raw.prepare("SELECT credits_remaining FROM user_mcu_balance WHERE user_id='user-1'").get()).toEqual({ credits_remaining: 50000 });
  });

  it('rolls back all contract fulfillment writes when invoice settlement fails', async () => {
    const { raw, d1 } = fixture();
    raw.exec("CREATE TRIGGER fail_invoice BEFORE UPDATE ON invoices BEGIN SELECT RAISE(ABORT, 'invoice failure'); END;");
    await expect(fulfillNowPaymentsContractOrder(d1, input)).rejects.toThrow('invoice failure');
    expect(raw.prepare("SELECT status FROM enterprise_contracts WHERE id='contract-1'").get()).toEqual({ status: 'signed' });
    expect(raw.prepare('SELECT COUNT(*) AS count FROM mcu_transactions').get()).toEqual({ count: 0 });
    expect(raw.prepare("SELECT processed FROM payment_events WHERE event_id='nowpayments_payment-1_finished'").get()).toEqual({ processed: 0 });
  });
});

describe('refundNowPaymentsContractOrder', () => {
  it('terminates a completed contract and reverses its MCU grant exactly once', async () => {
    const { raw, d1 } = fixture();
    await fulfillNowPaymentsContractOrder(d1, input);

    await refundNowPaymentsContractOrder(d1, {
      ...input, lockCreatedAt: 'refund-lock-1', orderStatus: 'completed', wasCompleted: true,
    });

    expect(raw.prepare("SELECT status FROM invoices WHERE id='invoice-1'").get()).toEqual({ status: 'refunded' });
    expect(raw.prepare("SELECT status FROM pending_orders WHERE order_id='order-1'").get()).toEqual({ status: 'refunded' });
    expect(raw.prepare("SELECT status FROM enterprise_contracts WHERE id='contract-1'").get()).toEqual({ status: 'terminated' });
    expect(raw.prepare("SELECT credits_remaining FROM user_mcu_balance WHERE user_id='user-1'").get()).toEqual({ credits_remaining: 0 });
    expect(raw.prepare("SELECT delta, reason FROM mcu_transactions WHERE payment_reference='payment-1_refund'").get())
      .toEqual({ delta: -50000, reason: 'ENTERPRISE_CONTRACT_REFUND' });
    expect(raw.prepare("SELECT processed FROM payment_events WHERE event_id='nowpayments_payment-1_refunded'").get())
      .toEqual({ processed: 1 });
  });

  it('marks a pre-fulfillment refund without granting or reversing MCU', async () => {
    const { raw, d1 } = fixture();

    await refundNowPaymentsContractOrder(d1, {
      ...input, lockCreatedAt: 'refund-lock-1', orderStatus: 'pending', wasCompleted: false,
    });

    expect(raw.prepare("SELECT status FROM invoices WHERE id='invoice-1'").get()).toEqual({ status: 'refunded' });
    expect(raw.prepare("SELECT status FROM pending_orders WHERE order_id='order-1'").get()).toEqual({ status: 'refunded' });
    expect(raw.prepare("SELECT status FROM enterprise_contracts WHERE id='contract-1'").get()).toEqual({ status: 'terminated' });
    expect(raw.prepare('SELECT COUNT(*) AS count FROM mcu_transactions').get()).toEqual({ count: 0 });
  });

  it('rejects a refund linked to a different provider invoice', async () => {
    const { raw, d1 } = fixture();

    await expect(refundNowPaymentsContractOrder(d1, {
      ...input, providerInvoiceId: 'other-invoice', lockCreatedAt: 'refund-lock-1',
      orderStatus: 'pending', wasCompleted: false,
    })).rejects.toThrow();

    expect(raw.prepare("SELECT status FROM invoices WHERE id='invoice-1'").get()).toEqual({ status: 'draft' });
    expect(raw.prepare("SELECT processed FROM payment_events WHERE event_id='nowpayments_payment-1_refunded'").get())
      .toEqual({ processed: 0 });
  });

  it('accepts a late refund for an older paid invoice without terminating a newer active invoice', async () => {
    const { raw, d1 } = fixture();
    await fulfillNowPaymentsContractOrder(d1, input);
    raw.exec("UPDATE enterprise_contracts SET last_invoice_id='invoice-2' WHERE id='contract-1'; UPDATE user_mcu_balance SET credits_remaining=80000 WHERE user_id='user-1';");

    await refundNowPaymentsContractOrder(d1, {
      ...input, lockCreatedAt: 'refund-lock-1', orderStatus: 'completed', wasCompleted: true,
    });

    expect(raw.prepare("SELECT status, last_invoice_id FROM enterprise_contracts WHERE id='contract-1'").get())
      .toEqual({ status: 'active', last_invoice_id: 'invoice-2' });
    expect(raw.prepare("SELECT credits_remaining FROM user_mcu_balance WHERE user_id='user-1'").get())
      .toEqual({ credits_remaining: 30000 });
    expect(raw.prepare("SELECT status FROM invoices WHERE id='invoice-1'").get()).toEqual({ status: 'refunded' });
  });

  it('reverses an older paid invoice after a later refund has terminated the contract', async () => {
    const { raw, d1 } = fixture();
    await fulfillNowPaymentsContractOrder(d1, input);
    raw.exec("UPDATE enterprise_contracts SET last_invoice_id='invoice-2', status='terminated' WHERE id='contract-1';");

    await refundNowPaymentsContractOrder(d1, {
      ...input, lockCreatedAt: 'refund-lock-1', orderStatus: 'completed', wasCompleted: true,
    });

    expect(raw.prepare("SELECT status, last_invoice_id FROM enterprise_contracts WHERE id='contract-1'").get())
      .toEqual({ status: 'terminated', last_invoice_id: 'invoice-2' });
    expect(raw.prepare("SELECT delta FROM mcu_transactions WHERE payment_reference='payment-1_refund'").get())
      .toEqual({ delta: -50000 });
  });

  it('handles a refund after the provider marked the order expired', async () => {
    const { raw, d1 } = fixture();
    raw.exec("UPDATE pending_orders SET status='expired' WHERE order_id='order-1';");

    await refundNowPaymentsContractOrder(d1, {
      ...input, lockCreatedAt: 'refund-lock-1', orderStatus: 'expired', wasCompleted: false,
    });

    expect(raw.prepare("SELECT status FROM pending_orders WHERE order_id='order-1'").get()).toEqual({ status: 'refunded' });
    expect(raw.prepare("SELECT status FROM invoices WHERE id='invoice-1'").get()).toEqual({ status: 'refunded' });
    expect(raw.prepare('SELECT COUNT(*) AS count FROM mcu_transactions').get()).toEqual({ count: 0 });
  });
});
