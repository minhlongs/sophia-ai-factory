import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Client } from '@/seed/db/client';

const mocks = vi.hoisted(() => ({ resolveOrgId: vi.fn() }));
vi.mock('@/seed/auth/workspace-access', () => ({ resolveOrgId: mocks.resolveOrgId }));

import { getPayOsTierConfig } from '@/land/payments/payos';
import { findAndValidatePayOsOrder } from './tier-activator-validator';

type QueryResult = { data: unknown; error: { message: string } | null };
type TestQuery = {
  select: () => TestQuery;
  eq: () => TestQuery;
  delete: () => TestQuery;
  then: (resolve: (result: QueryResult) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
};

function makeQuery(result: QueryResult): TestQuery {
  const query: TestQuery = {
    select: () => query,
    eq: () => query,
    delete: () => query,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

const pendingOrder = {
  order_id: 'order-1',
  user_id: 'user-1',
  tier: 'BASIC',
  period: 'monthly',
  amount_vnd: null,
  invoice_url: 'https://pay.payos.vn/web/link-1',
  subaccount_id: 'merchant-1',
};

function makeDb(result: QueryResult) {
  const pendingQuery = makeQuery(result);
  const eventQuery = makeQuery({ data: null, error: null });
  const from = vi.fn((table: string) => table === 'pending_orders' ? pendingQuery : eventQuery);
  return { db: { from } as unknown as D1Client, from, eventQuery };
}

function validate(db: D1Client, amount = getPayOsTierConfig('BASIC').vndAmount) {
  return findAndValidatePayOsOrder({
    db,
    orderCode: 123456,
    paymentLinkId: 'link-1',
    amount,
    eventId: 'event-1',
  });
}

describe('findAndValidatePayOsOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOrgId.mockResolvedValue('org-1');
  });

  it('cleans up the event and returns a retryable error when the order query fails', async () => {
    const { db, from } = makeDb({ data: null, error: { message: 'D1 unavailable' } });

    await expect(validate(db)).resolves.toMatchObject({ ok: false, status: 500, error: 'Database query failure' });
    expect(from).toHaveBeenCalledWith('payos_events');
  });

  it('returns not found for an empty pending-order list', async () => {
    const { db } = makeDb({ data: [], error: null });

    await expect(validate(db)).resolves.toMatchObject({ ok: false, status: 400, error: 'No pending orders' });
  });

  it('returns not found when no pending order matches the provider identifiers', async () => {
    const { db } = makeDb({ data: [{ ...pendingOrder, invoice_url: 'https://pay.payos.vn/web/other' }], error: null });

    await expect(validate(db)).resolves.toMatchObject({ ok: false, status: 400, error: 'Order not found' });
  });

  it('rejects a provider amount that differs from the saved invoice amount', async () => {
    const { db } = makeDb({ data: [pendingOrder], error: null });

    await expect(validate(db, getPayOsTierConfig('BASIC').vndAmount + 1))
      .resolves.toMatchObject({ ok: false, status: 400, error: 'Amount mismatch' });
  });

  it('fails closed when the paid order has no resolvable organization', async () => {
    mocks.resolveOrgId.mockResolvedValue(null);
    const { db } = makeDb({ data: [pendingOrder], error: null });

    await expect(validate(db)).resolves.toMatchObject({ ok: false, status: 500, error: 'Organization not found' });
  });

  it('uses the monthly period for standard subscriptions', async () => {
    const { db } = makeDb({ data: [pendingOrder], error: null });

    await expect(validate(db)).resolves.toMatchObject({
      ok: true,
      data: { orderId: 'order-1', userId: 'user-1', billingPeriod: 'monthly', orgId: 'org-1' },
    });
  });

  it('uses the annual price and billing period saved on the order', async () => {
    const yearlyOrder = { ...pendingOrder, period: 'yearly' };
    const { db } = makeDb({ data: [yearlyOrder], error: null });

    await expect(validate(db, getPayOsTierConfig('BASIC', 'yearly').vndAmount))
      .resolves.toMatchObject({ ok: true, data: { billingPeriod: 'yearly' } });
  });

  it('keeps lifetime tier activation permanent', async () => {
    const lifetimeOrder = { ...pendingOrder, tier: 'MASTER', period: 'monthly' };
    const { db } = makeDb({ data: [lifetimeOrder], error: null });

    await expect(validate(db, getPayOsTierConfig('MASTER').vndAmount))
      .resolves.toMatchObject({ ok: true, data: { tier: 'MASTER', billingPeriod: 'lifetime' } });
  });
});
