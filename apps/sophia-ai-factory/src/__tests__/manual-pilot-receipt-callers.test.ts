// @vitest-environment node
import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { dispatchPayOsNotificationsAndTags } from '@/app/api/webhooks/payos/modules/payos-fulfillment-notifications';
import { runPayOsPostActivationEffects } from '@/app/api/payos/ipn/modules/tier-activator-effects';

const mocks = vi.hoisted(() => ({ receipt: vi.fn(), handles: new Set<DatabaseSync>() }));
vi.mock('@/seed/db/node-sqlite/migrations', () => ({
  applyMigrations: (handle: DatabaseSync) => { mocks.handles.add(handle); },
}));
vi.mock('@/land/billing/email/receipt-email-sender', () => ({ sendReceiptEmail: mocks.receipt }));
vi.mock('@/seed/db/client', () => ({ getD1Raw: async () => null }));
vi.mock('@/seed/db/audit/audit-log', () => ({ recordAudit: vi.fn() }));
vi.mock('@/tree/telegram/telegram-admin-notifier', () => ({ notifyFounderPaymentSuccess: vi.fn() }));

type Rail = 'webhook' | 'ipn';
async function fixture(rail: Rail) {
  const raw = new NodeSqliteD1Database(':memory:');
  for (const file of ['0002-payment-events', '0053-mcu-credits', '0070-pending-orders', '0072-payos-events',
    '0188_add_amount_vnd_to_pending_orders', '0477_payos_contract_fulfillment']) {
    await raw.exec(readFileSync(`migrations/${file}.sql`, 'utf8'));
  }
  const paymentId = rail === 'webhook' ? 'payos_link' : 'payos_123';
  await raw.prepare(`INSERT INTO pending_orders(order_id,user_id,tier,period,payment_method,amount_usd_cents,
    amount_vnd,provider_order_code,status,payment_id) VALUES('order','u','BASIC','pilot_14d','payos',7900,1990000,123,'completed',?)`)
    .bind(paymentId).run();
  await raw.exec(`INSERT INTO mcu_transactions(user_id,delta,reason,payment_reference)
    VALUES('u',500,'PAYOS_SUBSCRIPTION_ACTIVATION','payos_order_order')`);
  if (rail === 'webhook') {
    await raw.prepare(`INSERT INTO payment_events(event_id,event_type,payload,processed)
      VALUES(?,'payos.payment_success',?,1)`).bind(paymentId, JSON.stringify({
      data: { orderCode: 123, code: '00', amount: 1990000, currency: 'VND', paymentLinkId: 'link' },
    })).run();
  } else {
    await raw.prepare(`INSERT INTO payos_events(event_id,order_code,status,amount,currency,payload,processed)
      VALUES(?,'123','PAID',1990000,'VND','{}',1)`).bind(paymentId).run();
  }
  return raw;
}

async function call(raw: NodeSqliteD1Database, rail: Rail, period: 'pilot_14d' | 'monthly' = 'pilot_14d') {
  const db = {
    unwrap: () => raw,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { email: 'fixture@example.test' } }) }) }) }),
  };
  const common = { db, userId: 'u', tier: 'BASIC', amount: 999, orgId: 'org', periodEnd: '2099-01-01' };
  if (rail === 'webhook') {
    await dispatchPayOsNotificationsAndTags({ ...common, order: { order_id: 'order', period }, paymentLinkId: 'link', isLifetime: false } as unknown as Parameters<typeof dispatchPayOsNotificationsAndTags>[0]);
  } else {
    await runPayOsPostActivationEffects({ ...common, d1: raw, billingPeriod: period, orderCode: 123, orderId: 'order', subaccountId: undefined } as unknown as Parameters<typeof runPayOsPostActivationEffects>[0]);
  }
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  for (const handle of mocks.handles) handle.close();
  mocks.handles.clear();
});
for (const rail of ['webhook', 'ipn'] as const) describe(rail, () => {
  const events = rail === 'webhook' ? 'payment_events' : 'payos_events';
  it('uses exact committed Pilot values without manual tables or webhook arguments', async () => {
    const raw = await fixture(rail);
    await call(raw, rail);
    expect(mocks.receipt).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      period: 'pilot_14d', amountVnd: 1990000, amountUsd: 79, activationStatus: 'ACTIVE_14D',
    }));
  });
  it('preserves legacy orders without a stored VND amount when the committed event proves the canonical price', async () => {
    const raw = await fixture(rail);
    await raw.exec('UPDATE pending_orders SET amount_vnd=NULL');
    await call(raw, rail);
    expect(mocks.receipt).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ amountVnd: 1990000 }));
  });
  it.each([
    "UPDATE pending_orders SET status='pending'",
    "UPDATE pending_orders SET user_id='other'",
    "UPDATE pending_orders SET payment_id='payos_other'",
    'UPDATE pending_orders SET amount_vnd=1',
    `UPDATE ${events} SET processed=0`,
    `DELETE FROM ${events}`,
    rail === 'webhook' ? "UPDATE payment_events SET payload='not-json'" : "UPDATE payos_events SET status='CANCELLED'",
    rail === 'webhook' ? "UPDATE payment_events SET payload=json_set(payload,'$.data.amount',1)" : 'UPDATE payos_events SET amount=1',
    'UPDATE mcu_transactions SET delta=499',
    "UPDATE mcu_transactions SET user_id='other'",
    'DELETE FROM mcu_transactions',
  ])('does not send a Pilot receipt after %s', async (sql) => {
    const raw = await fixture(rail);
    await raw.exec(sql);
    await call(raw, rail);
    expect(mocks.receipt).not.toHaveBeenCalled();
  });
  it('preserves nonpilot receipts without requiring evidence tables', async () => {
    await call(new NodeSqliteD1Database(':memory:'), rail, 'monthly');
    expect(mocks.receipt).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ period: 'monthly' }));
  });
});
