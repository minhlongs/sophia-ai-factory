import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import type { MethodDispatcherInput } from './payment-dispatcher';

const mocks = vi.hoisted(() => ({ createPayOsInvoice: vi.fn(), getPayOsTierConfig: vi.fn(), writeOrder: vi.fn(), isPayOsEnabled: vi.fn() }));
vi.mock('@/land/payments/payos', () => ({ createPayOsInvoice: mocks.createPayOsInvoice, getPayOsTierConfig: mocks.getPayOsTierConfig }));
vi.mock('@/land/orders/pending-order-repo', () => ({ writeOrder: mocks.writeOrder }));
vi.mock('@/seed/config/flags', () => ({ isPayOsEnabled: mocks.isPayOsEnabled }));
import { dispatchPayOsMethod } from './payment-dispatcher-providers';

const consent = { accepted: true as const, version: OPTION_A_PILOT_CONTRACT.termsVersion, hash: OPTION_A_PILOT_CONTRACT.termsHash, locale: 'en' as const };
const pilotInput: MethodDispatcherInput = { paymentMethod: 'payos', tier: 'BASIC', userId: 'user-1', period: 'pilot_14d', agreement: consent };

describe('payment provider dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.isPayOsEnabled.mockReturnValue(true);
    mocks.createPayOsInvoice.mockResolvedValue({ checkoutUrl: 'https://pay.payos.vn/web/link-1', paymentLinkId: 'link-1', orderCode: 123456 });
    mocks.getPayOsTierConfig.mockReturnValue({ usdAmount: 199, vndAmount: 5000000 }); mocks.writeOrder.mockResolvedValue(undefined);
  });
  it('preserves ordinary monthly PayOS behavior', async () => {
    const response = await dispatchPayOsMethod({ paymentMethod: 'payos', tier: 'BASIC', userId: 'u', period: 'monthly' });
    expect(response.status).toBe(200); expect(mocks.createPayOsInvoice).toHaveBeenCalled();
  });
  it('rejects pilot consent before any provider or order call', async () => {
    const response = await dispatchPayOsMethod({ ...pilotInput, agreement: undefined });
    expect(response.status).toBe(400); expect(mocks.createPayOsInvoice).not.toHaveBeenCalled(); expect(mocks.writeOrder).not.toHaveBeenCalled();
  });
  it('routes every valid pilot payment method away from PayOS', async () => {
    const response = await dispatchPayOsMethod(pilotInput);
    expect(response.status).toBe(503); expect(mocks.createPayOsInvoice).not.toHaveBeenCalled(); expect(mocks.writeOrder).not.toHaveBeenCalled();
  });
  it('keeps non-pilot PayOS disabled when the feature flag is false', async () => {
    mocks.isPayOsEnabled.mockReturnValue(false);
    const response = await dispatchPayOsMethod({ paymentMethod: 'payos', tier: 'BASIC', userId: 'u', period: 'monthly' });
    expect(response.status).toBe(503); expect(mocks.createPayOsInvoice).not.toHaveBeenCalled();
  });
});
