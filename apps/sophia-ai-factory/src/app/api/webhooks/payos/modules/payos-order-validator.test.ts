import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

const { markOrderFailed } = vi.hoisted(() => ({ markOrderFailed: vi.fn() }));

vi.mock('@/land/orders/pending-order-repo', () => ({ markOrderFailed }));

import { getPayOsTierConfig } from '@/land/payments/payos';
import { validatePendingPayOsOrder } from './payos-order-validator';

const order: PendingOrder = {
  order_id: 'sophia_user-1_123',
  user_id: 'user-1',
  tier: 'BASIC',
  period: 'monthly',
  payment_method: 'payos',
  amount_usd_cents: 19900,
  promo_code: null,
  customer_email: null,
  invoice_url: 'https://pay.payos.vn/web/link-1',
  provider_payment_id: 'link-1',
  status: 'pending',
  payment_id: null,
  created_at: '2026-10-18T00:00:00.000Z',
  completed_at: null,
};

function makeDb(testOrder = order, lookupError: { message: string; code?: string } | null = null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => ({ data: testOrder, error: lookupError })),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
  };
  const db = { from: vi.fn(() => query) } as unknown as DbClient;
  return { db, query };
}

describe('validatePendingPayOsOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts only the exact configured VND amount', async () => {
    const { db } = makeDb();
    const expectedVndAmount = getPayOsTierConfig('BASIC').vndAmount;

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: expectedVndAmount,
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(markOrderFailed).not.toHaveBeenCalled();
  });

  it('validates annual payment against the annual price for the stored order period', async () => {
    const annualOrder = { ...order, period: 'yearly' as const };
    const { db } = makeDb(annualOrder);
    const expectedVndAmount = getPayOsTierConfig('BASIC', 'yearly').vndAmount;

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: expectedVndAmount,
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(markOrderFailed).not.toHaveBeenCalled();
  });

  it('uses the saved VND invoice amount as the validation snapshot', async () => {
    const savedAmountVnd = 4_976_000;
    const { db } = makeDb({ ...order, amount_vnd: savedAmountVnd });

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: savedAmountVnd,
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.expectedVndAmount).toBe(savedAmountVnd);
    expect(markOrderFailed).not.toHaveBeenCalled();
  });

  it('returns a retryable server error on pending-order database failures', async () => {
    const { db } = makeDb(order, { message: 'D1 unavailable', code: 'D1_ERROR' });

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: 4_975_000,
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(500);
  });

  it.each([4_974_999, 4_975_001])('rejects mismatched amount %s without granting the tier', async (amount) => {
    const { db, query } = makeDb();
    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount,
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    expect(markOrderFailed).toHaveBeenCalledWith(order.order_id, 'amount_mismatch');
    expect(query.update).toHaveBeenCalledWith({ processed: 1 });
  });
});
