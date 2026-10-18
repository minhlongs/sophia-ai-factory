import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MethodDispatcherInput } from './payment-dispatcher';

const mocks = vi.hoisted(() => ({
  createPayOsInvoice: vi.fn(),
  getPayOsTierConfig: vi.fn(),
  writeOrder: vi.fn(),
}));

vi.mock('@/land/payments/payos', () => ({
  createPayOsInvoice: mocks.createPayOsInvoice,
  getPayOsTierConfig: mocks.getPayOsTierConfig,
}));
vi.mock('@/land/orders/pending-order-repo', () => ({ writeOrder: mocks.writeOrder }));

import { dispatchPayOsMethod } from './payment-dispatcher-providers';

describe('dispatchPayOsMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPayOsInvoice.mockResolvedValue({
      checkoutUrl: 'https://pay.payos.vn/web/link-1',
      qrUrl: 'https://pay.payos.vn/qr/link-1',
      paymentLinkId: 'link-1',
      orderCode: 123456,
      expiresAt: '2026-10-18T10:00:00.000Z',
    });
    mocks.getPayOsTierConfig.mockReturnValue({ usdAmount: 1990, vndAmount: 49_750_000 });
    mocks.writeOrder.mockResolvedValue(undefined);
  });

  it('charges and stores the annual price for an annual PayOS order', async () => {
    const input: MethodDispatcherInput = {
      paymentMethod: 'payos',
      tier: 'BASIC',
      userId: 'user-1',
      period: 'yearly',
    };

    const response = await dispatchPayOsMethod(input);

    expect(response.status).toBe(200);
    expect(mocks.createPayOsInvoice).toHaveBeenCalledWith(expect.objectContaining({ period: 'yearly' }));
    expect(mocks.getPayOsTierConfig).toHaveBeenCalledWith('BASIC', 'yearly');
    expect(mocks.writeOrder).toHaveBeenCalledWith(expect.objectContaining({
      period: 'yearly',
      amount_usd_cents: 199_000,
      amount_vnd: 49_750_000,
      provider_payment_id: 'link-1',
    }));
  });

  it('does not expose a payable checkout when order persistence fails', async () => {
    mocks.writeOrder.mockRejectedValue(new Error('D1 unavailable'));
    const response = await dispatchPayOsMethod({
      paymentMethod: 'payos',
      tier: 'BASIC',
      userId: 'user-1',
      period: 'monthly',
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('D1 unavailable') });
  });
});
