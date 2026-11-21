import { describe, expect, it, vi } from 'vitest';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';

const mocks = vi.hoisted(() => ({ createPayOsInvoice: vi.fn(), writeOrder: vi.fn() }));
vi.mock('@/land/payments/payos', () => ({ createPayOsInvoice: mocks.createPayOsInvoice, getPayOsTierConfig: vi.fn() }));
vi.mock('@/land/orders/pending-order-repo', () => ({ writeOrder: mocks.writeOrder }));
vi.mock('@/seed/config/flags', () => ({ isPayOsEnabled: () => true }));
import { dispatchPayOsMethod } from './payment-dispatcher-providers';

const agreement = { accepted: true as const, version: OPTION_A_PILOT_CONTRACT.termsVersion, hash: OPTION_A_PILOT_CONTRACT.termsHash, locale: 'en' as const };

describe('pilot cannot use PayOS', () => {
  it('routes an accepted pilot to offline orchestration, never calls a provider', async () => {
    const response = await dispatchPayOsMethod({ paymentMethod: 'payos', tier: 'BASIC', userId: 'u', period: 'pilot_14d', agreement });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'MANUAL_PILOT_UNAVAILABLE' });
    expect(mocks.createPayOsInvoice).not.toHaveBeenCalled();
    expect(mocks.writeOrder).not.toHaveBeenCalled();
  });
  it('rejects absent or stale consent before any provider invocation', async () => {
    const response = await dispatchPayOsMethod({ paymentMethod: 'payos', tier: 'BASIC', userId: 'u', period: 'pilot_14d' });
    expect(response.status).toBe(400);
    expect(mocks.createPayOsInvoice).not.toHaveBeenCalled();
    expect(mocks.writeOrder).not.toHaveBeenCalled();
  });
});

it('keeps the canonical hash synchronized with the agreement payload', async () => {
  const { computeOptionAAgreementHash } = await import('@/seed/config/tiers/option-a-pilot-contract');
  await expect(computeOptionAAgreementHash()).resolves.toBe(OPTION_A_PILOT_CONTRACT.termsHash);
});
