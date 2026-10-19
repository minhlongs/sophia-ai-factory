import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { PendingOrder } from '@/land/orders/pending-order-types';

const mocks = vi.hoisted(() => ({
  verifyPayOsRequest: vi.fn(),
  checkAndRecordPaymentIdempotency: vi.fn(),
  validatePendingPayOsOrder: vi.fn(),
  activatePayOsSubscription: vi.fn(),
  processPayOsPostFulfillment: vi.fn(),
  getContractById: vi.fn(),
  fulfillPayOsContractOrder: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({ createServerClient: () => ({ unwrap: () => ({}) }) }));
vi.mock('./modules', () => mocks);
vi.mock('@/land/contracts/quote-to-cash-workflow', () => ({
  getContractById: mocks.getContractById,
  fulfillPayOsContractOrder: mocks.fulfillPayOsContractOrder,
}));

import { POST } from './route';

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
const contract = { id: 'contract-1', lastInvoiceId: 'invoice-1' };

const ipn = {
  code: '00',
  desc: 'success',
  success: true,
  signature: 'body-signature',
  data: {
    orderCode: 123456,
    amount: 4975000,
    description: 'Sophia BASIC - user-1_123',
    paymentLinkId: 'link-1',
    code: '00',
  },
};

function makeRequest(): NextRequest {
  return new NextRequest('https://sophia.test/api/webhooks/payos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ipn),
  });
}

describe('POST /api/webhooks/payos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPayOsRequest.mockResolvedValue({
      ok: true,
      data: { rawBody: JSON.stringify(ipn), sanitizedBody: JSON.stringify(ipn), ipn },
    });
    mocks.checkAndRecordPaymentIdempotency.mockResolvedValue({
      shouldProcess: true,
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });
    mocks.validatePendingPayOsOrder.mockResolvedValue({ ok: true, order, expectedVndAmount: 4975000 });
    mocks.activatePayOsSubscription.mockResolvedValue({
      orgId: 'org-1',
      periodEnd: '2026-11-17T00:00:00.000Z',
      isLifetime: false,
    });
    mocks.processPayOsPostFulfillment.mockResolvedValue(undefined);
    mocks.getContractById.mockResolvedValue(contract);
    mocks.fulfillPayOsContractOrder.mockResolvedValue(undefined);
  });

  it('validates the event, matches the invoice and activates the paid tier once', async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(mocks.checkAndRecordPaymentIdempotency).toHaveBeenCalledWith(expect.objectContaining({
      paymentLinkId: 'link-1',
    }));
    expect(mocks.validatePendingPayOsOrder).toHaveBeenCalledWith(expect.objectContaining({
      paymentLinkId: 'link-1',
      orderCode: 123456,
      amount: 4975000,
    }));
    expect(mocks.activatePayOsSubscription).toHaveBeenCalledTimes(1);
    expect(mocks.activatePayOsSubscription).toHaveBeenCalledWith(expect.objectContaining({
      userId: order.user_id,
    }));
    expect(mocks.processPayOsPostFulfillment).toHaveBeenCalledTimes(1);
  });

  it('does not activate a tier when the callback is a duplicate', async () => {
    mocks.checkAndRecordPaymentIdempotency.mockResolvedValue({
      shouldProcess: false,
      response: NextResponse.json({ received: true, duplicate: true }),
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(mocks.validatePendingPayOsOrder).not.toHaveBeenCalled();
    expect(mocks.activatePayOsSubscription).not.toHaveBeenCalled();
  });

  it('uses the signed transaction code instead of unsigned root success fields', async () => {
    const request = new NextRequest('https://sophia.test/api/webhooks/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ipn, code: '99', success: false }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.activatePayOsSubscription).toHaveBeenCalledTimes(1);
    expect(mocks.activatePayOsSubscription).toHaveBeenCalledWith(expect.objectContaining({ userId: order.user_id }));
  });

  it('does not fulfill a signed non-success transaction even when root flags claim success', async () => {
    mocks.verifyPayOsRequest.mockResolvedValue({
      ok: true,
      data: {
        rawBody: JSON.stringify(ipn),
        sanitizedBody: JSON.stringify(ipn),
        ipn: { ...ipn, data: { ...ipn.data, code: '01' } },
      },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(mocks.checkAndRecordPaymentIdempotency).not.toHaveBeenCalled();
    expect(mocks.activatePayOsSubscription).not.toHaveBeenCalled();
  });

  it('does not activate a tier when the order or amount validation fails', async () => {
    mocks.validatePendingPayOsOrder.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ received: true, status: 'amount_mismatch' }),
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(mocks.activatePayOsSubscription).not.toHaveBeenCalled();
    expect(mocks.processPayOsPostFulfillment).not.toHaveBeenCalled();
  });

  it('fulfills contract orders without invoking SaaS tier or post-fulfillment effects', async () => {
    const contractOrder: PendingOrder = {
      ...order, tier: 'ENTERPRISE', purpose: 'contract', contract_id: 'contract-1',
      invoice_id: 'invoice-1', provider_order_code: 123456, amount_vnd: 5_775_000,
    };
    mocks.validatePendingPayOsOrder.mockResolvedValue({
      ok: true, order: contractOrder, expectedVndAmount: 5_775_000,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(mocks.fulfillPayOsContractOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      contract, invoiceId: 'invoice-1', orderId: contractOrder.order_id,
      paidByUserId: contractOrder.user_id, paymentReference: 'link-1',
      providerOrderCode: 123456, amountVnd: 5_775_000,
    }));
    expect(mocks.activatePayOsSubscription).not.toHaveBeenCalled();
    expect(mocks.processPayOsPostFulfillment).not.toHaveBeenCalled();
  });
});
