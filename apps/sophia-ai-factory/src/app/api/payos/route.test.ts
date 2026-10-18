import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUserFromHeaders: vi.fn(),
  createPayOsInvoice: vi.fn(),
  getPayOsTierConfig: vi.fn(),
  writeOrder: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: mocks.getCurrentUserFromHeaders,
}));
vi.mock('@/land/payments/payos', () => ({
  FEATURE_PAYOS: true,
  createPayOsInvoice: mocks.createPayOsInvoice,
  getPayOsTierConfig: mocks.getPayOsTierConfig,
}));
vi.mock('@/land/orders/pending-order-repo', () => ({ writeOrder: mocks.writeOrder }));
vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (request: NextRequest) => Promise<Response>) => handler,
}));

import { POST } from './route';

describe('POST /api/payos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromHeaders.mockResolvedValue({ id: 'user-1' });
    mocks.getPayOsTierConfig.mockReturnValue({ usdAmount: 199, vndAmount: 4975000 });
    mocks.createPayOsInvoice.mockResolvedValue({
      checkoutUrl: 'https://pay.payos.vn/web/link-1',
      qrUrl: 'https://pay.payos.vn/qr/link-1',
      paymentLinkId: 'link-1',
      orderCode: 123456,
      expiresAt: '2026-10-18T10:00:00.000Z',
    });
  });

  it('persists the provider payment id so the signed callback can match the exact order', async () => {
    const request = new NextRequest('https://sophia.test/api/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'BASIC', period: 'monthly' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.writeOrder).toHaveBeenCalledWith(expect.objectContaining({
      payment_method: 'payos',
      provider_payment_id: 'link-1',
      amount_vnd: 4975000,
      invoice_url: 'https://pay.payos.vn/web/link-1',
    }));
  });

  it('does not return the payment link if the pending order cannot be persisted', async () => {
    mocks.writeOrder.mockRejectedValueOnce(new Error('D1 unavailable'));
    const request = new NextRequest('https://sophia.test/api/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'BASIC', period: 'monthly' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('D1 unavailable') });
  });

  it('rejects lifetime billing for tiers that are not lifetime products', async () => {
    const request = new NextRequest('https://sophia.test/api/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'BASIC', period: 'lifetime' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mocks.createPayOsInvoice).not.toHaveBeenCalled();
    expect(mocks.writeOrder).not.toHaveBeenCalled();
  });
});
