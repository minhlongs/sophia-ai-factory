import { beforeEach, describe, expect, it, vi } from 'vitest';

const { processTopupIpnMock } = vi.hoisted(() => ({ processTopupIpnMock: vi.fn() }));

vi.mock('@/land/billing/overage-topup', () => ({ processTopupIpn: processTopupIpnMock }));
vi.mock('@/land/commerce/commerce-payment', () => ({ confirmCommercePayment: vi.fn() }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { processTopupIfApplicable } from './payment-processor';

describe('processTopupIfApplicable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processTopupIpnMock.mockResolvedValue({ success: true, message: 'Top-up processed' });
  });

  it('forwards invoice and crypto amount fields to the top-up verifier', async () => {
    const ipn = {
      payment_id: 'payment-1',
      payment_status: 'finished' as const,
      price_amount: 1,
      price_currency: 'USD',
      pay_amount: 15,
      pay_currency: 'TRX',
      actually_paid: 15,
      order_id: 'topup_user1_123',
      invoice_id: 'invoice-1',
    };

    const response = await processTopupIfApplicable(ipn);

    expect(response?.status).toBe(200);
    expect(processTopupIpnMock).toHaveBeenCalledWith(ipn);
  });
});
