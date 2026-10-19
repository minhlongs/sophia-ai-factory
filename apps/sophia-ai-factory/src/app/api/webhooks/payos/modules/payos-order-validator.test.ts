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

function makeDb(testOrder: unknown = order, lookupError: { message: string; code?: string } | null = null) {
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

  it('accepts a contract order only with its recorded amount, provider code, and VND currency', async () => {
    const contractOrder: PendingOrder = {
      ...order,
      purpose: 'contract',
      contract_id: 'contract-1',
      invoice_id: 'invoice-1',
      provider_order_code: 123456,
      amount_vnd: 5_775_000,
    };
    const { db } = makeDb(contractOrder);
    const result = await validatePendingPayOsOrder({
      db, paymentLinkId: 'link-1', orderCode: 123456, amount: 5_775_000,
      currency: 'VND', lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.expectedVndAmount).toBe(5_775_000);
  });

  it('rejects contract callbacks with the wrong PayOS order code or currency', async () => {
    const contractOrder: PendingOrder = {
      ...order,
      purpose: 'contract', contract_id: 'contract-1', invoice_id: 'invoice-1',
      provider_order_code: 123456, amount_vnd: 5_775_000,
    };
    const wrongCode = await validatePendingPayOsOrder({
      db: makeDb(contractOrder).db, paymentLinkId: 'link-1', orderCode: 123457,
      amount: 5_775_000, currency: 'VND', lockCreatedAt: 'lock-1',
    });
    expect(wrongCode.ok).toBe(false);
    if (!wrongCode.ok) expect(wrongCode.response.status).toBe(400);

    const wrongCurrency = await validatePendingPayOsOrder({
      db: makeDb(contractOrder).db, paymentLinkId: 'link-1', orderCode: 123456,
      amount: 5_775_000, currency: 'USD', lockCreatedAt: 'lock-1',
    });
    expect(wrongCurrency.ok).toBe(false);
    if (!wrongCurrency.ok) expect(wrongCurrency.response.status).toBe(400);
  });

  it('fails closed when a contract IPN omits currency', async () => {
    const contractOrder: PendingOrder = {
      ...order, purpose: 'contract', contract_id: 'contract-1', invoice_id: 'invoice-1',
      provider_order_code: 123456, amount_vnd: 5_775_000,
    };
    const result = await validatePendingPayOsOrder({
      db: makeDb(contractOrder).db, paymentLinkId: 'link-1', orderCode: 123456,
      amount: 5_775_000, lockCreatedAt: 'lock-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it('recovers the durable intent by PayOS order code when paymentLinkId persistence lagged', async () => {
    const contractOrder: PendingOrder = {
      ...order, provider_payment_id: null, purpose: 'contract', contract_id: 'contract-1',
      invoice_id: 'invoice-1', provider_order_code: 123456, amount_vnd: 5_775_000,
    };
    let singleCall = 0;
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), delete: vi.fn(() => query),
      single: vi.fn(async () => {
        singleCall += 1;
        return singleCall === 1
          ? { data: null, error: { code: 'PGRST116', message: 'not found' } }
          : { data: contractOrder, error: null };
      }),
    };
    const db = { from: vi.fn(() => query) } as unknown as DbClient;
    const result = await validatePendingPayOsOrder({
      db, paymentLinkId: 'link-1', orderCode: 123456, amount: 5_775_000,
      currency: 'VND', lockCreatedAt: 'lock-1',
    });

    expect(result.ok).toBe(true);
    expect(query.eq).toHaveBeenCalledWith('provider_order_code', 123456);
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

  it('returns not found when both payment link and order code lookups miss', async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
      delete: vi.fn(() => query),
    };
    const db = { from: vi.fn(() => query) } as unknown as DbClient;

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'missing-link',
      orderCode: 123456,
      amount: 4_975_000,
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
    expect(query.single).toHaveBeenCalledTimes(2);
    expect(query.delete).toHaveBeenCalled();
  });

  it('rejects a fallback order whose stored payment link differs from the callback', async () => {
    const fallbackOrder = { ...order, provider_payment_id: 'another-link' };
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      single: vi.fn()
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } })
        .mockResolvedValueOnce({ data: fallbackOrder, error: null }),
      delete: vi.fn(() => query),
    };
    const db = { from: vi.fn(() => query) } as unknown as DbClient;

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: 4_975_000,
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
    expect(query.delete).toHaveBeenCalled();
  });

  it('rejects a callback with a mismatched stored PayOS order code', async () => {
    const { db, query } = makeDb({ ...order, provider_order_code: 123457 });

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: 4_975_000,
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
    expect(query.delete).toHaveBeenCalled();
  });

  it('rejects order records with an unsupported purpose', async () => {
    const { db } = makeDb({ ...order, purpose: 'unsupported' });

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: 4_975_000,
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
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
