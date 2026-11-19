import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

vi.mock('@/land/orders/pending-order-repo', () => ({ markOrderFailed: vi.fn() }));

import { validatePendingPayOsOrder } from './payos-order-validator';
import { getPayOsTierConfig } from '@/land/payments/payos';

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
  provider_order_code: 123456,
  status: 'pending',
  payment_id: null,
  created_at: '2026-10-18T00:00:00.000Z',
  completed_at: null,
};

/**
 * Build a db mock that returns the given orders through the thenable path
 * (used by validatePayOsPaymentIdentity) and supports the delete-chain releaseLock.
 * Optionally injects an error for the pending_orders lookup.
 */
function makeDb(
  testOrders: PendingOrder | PendingOrder[] | null = order,
  lookupError: { message: string; code?: string } | null = null,
) {
  const rows = testOrders == null ? [] : Array.isArray(testOrders) ? testOrders : [testOrders];
  const query = {
    _table: '',
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    delete: vi.fn(() => query),
    update: vi.fn(() => query),
    single: vi.fn(async () => ({ data: null, error: null })),
    then: vi.fn((resolve: (v: unknown) => void) => {
      if (lookupError) {
        resolve({ data: null, error: lookupError });
      } else {
        resolve({ data: rows, error: null });
      }
    }),
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
      currency: 'VND',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
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
      currency: 'VND',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
  });

  it('uses the saved VND invoice amount as the validation snapshot', async () => {
    const savedAmountVnd = 4_976_000;
    const { db } = makeDb({ ...order, amount_vnd: savedAmountVnd });

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: savedAmountVnd,
      currency: 'VND',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.expectedVndAmount).toBe(savedAmountVnd);
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
    // Wrong order code: db returns order with code 123456 but callback claims 123457,
    // so matchesPayOsIdentity rejects (storedCode !== String(orderCode)).
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
    // provider_payment_id is null, so matchesPayOsIdentity falls back to invoice_url comparison.
    // invoice_url = 'https://pay.payos.vn/web/' + paymentLinkId (i.e. 'link-1').
    const contractOrder: PendingOrder = {
      ...order, provider_payment_id: null, purpose: 'contract', contract_id: 'contract-1',
      invoice_id: 'invoice-1', provider_order_code: 123456, amount_vnd: 5_775_000,
      invoice_url: 'https://pay.payos.vn/web/link-1',
    };
    const { db, query } = makeDb(contractOrder);
    const result = await validatePendingPayOsOrder({
      db, paymentLinkId: 'link-1', orderCode: 123456, amount: 5_775_000,
      currency: 'VND', lockCreatedAt: 'lock-1',
    });

    expect(result.ok).toBe(true);
    // The identity lookup uses eq('provider_order_code', ...) and eq('payment_method', 'payos')
    expect(query.eq).toHaveBeenCalledWith('provider_order_code', 123456);
  });

  it('returns a retryable server error on pending-order database failures', async () => {
    const { db, query } = makeDb(null, { message: 'D1 unavailable', code: 'D1_ERROR' });

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: 4_975_000,
      currency: 'VND',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(500);
    // A failed lookup must release the lease so PayOS can redeliver.
    expect(query.delete).toHaveBeenCalled();
  });

  it('returns not found when both payment link and order code lookups miss', async () => {
    // db returns empty array — validatePayOsPaymentIdentity finds no matching rows
    const { db, query } = makeDb([]);

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'missing-link',
      orderCode: 123456,
      amount: 4_975_000,
      currency: 'VND',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
    expect(query.delete).toHaveBeenCalled();
  });

  it('rejects a fallback order whose stored payment link differs from the callback', async () => {
    // Stored provider_payment_id is 'another-link', callback claims 'link-1' — mismatch
    const fallbackOrder = { ...order, provider_payment_id: 'another-link' };
    const { db } = makeDb(fallbackOrder);

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: 4_975_000,
      currency: 'VND',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it('rejects a callback with a mismatched stored PayOS order code', async () => {
    const { db } = makeDb({ ...order, provider_order_code: 123457 });

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: 4_975_000,
      currency: 'VND',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it('fails closed when more than one stored order matches the same identity', async () => {
    // Two rows satisfy the identity predicate — ambiguity must not pick one.
    const { db } = makeDb([
      { ...order, order_id: 'sophia_user-1_123' },
      { ...order, order_id: 'sophia_user-2_123' },
    ]);

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: 4_975_000,
      currency: 'VND',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await result.response.json()).toMatchObject({ error: 'Payment identity mismatch' });
    }
  });

  it('rejects order records with an unsupported purpose', async () => {
    const { db } = makeDb({ ...order, purpose: 'unsupported' as never });

    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: 4_975_000,
      currency: 'VND',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it.each([4_974_999, 4_975_001])('rejects mismatched amount %s without granting the tier', async (amount) => {
    const { db } = makeDb();
    const result = await validatePendingPayOsOrder({
      db,
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount,
      currency: 'VND',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
    // Production no longer calls markOrderFailed or updates processed=1;
    // the identity validator returns 'Amount mismatch' without side effects.
  });
});
