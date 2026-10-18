import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findActivePendingOrder: vi.fn(),
  processPromoReservation: vi.fn(),
  executeFreeOrderHandover: vi.fn(),
}));

vi.mock('@/land/orders/pending-order-repo', () => ({
  findActivePendingOrder: mocks.findActivePendingOrder,
}));

vi.mock('./modules', () => ({
  processPromoReservation: mocks.processPromoReservation,
  executeFreeOrderHandover: mocks.executeFreeOrderHandover,
}));

import { findActivePendingOrder } from '@/land/orders/pending-order-repo';
import { tryHandleFreePromoOrder, tryReusePendingOrder } from './checkout-route-helpers';

const mockFindPending = vi.mocked(findActivePendingOrder);

describe('checkout route helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.processPromoReservation.mockResolvedValue({
      promoDiscountCents: 19_900,
      promoTrialDays: 0,
      calc: { isFreeOrder: true },
      validation: { valid: true, discountType: 'free_full' },
    });
    mocks.executeFreeOrderHandover.mockResolvedValue({
      freeOrderId: 'order-free-1',
      handoverId: 'handover-1',
      magicLink: 'https://example.test/handover',
    });
  });

  describe('tryReusePendingOrder', () => {
    it('returns a reusable invoice URL and preserves its order ID', async () => {
      mockFindPending.mockResolvedValue({
        invoice_url: 'https://provider.test/invoice-1',
        order_id: 'order-1',
      } as never);

      const response = await tryReusePendingOrder({
        userId: 'user-1', tier: 'BASIC', period: 'monthly', paymentMethod: 'nowpayments',
      });

      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);
      await expect(response?.json()).resolves.toEqual({
        url: 'https://provider.test/invoice-1',
        orderId: 'order-1',
        deduped: true,
      });
      expect(mockFindPending).toHaveBeenCalledWith({
        userId: 'user-1', tier: 'BASIC', period: 'monthly',
        paymentMethod: 'nowpayments', sinceMs: 86_400_000,
      });
    });

    it('returns null when no reusable pending invoice exists', async () => {
      mockFindPending.mockResolvedValue(null);
      await expect(tryReusePendingOrder({
        userId: 'user-1', tier: 'BASIC', period: 'monthly', paymentMethod: 'nowpayments',
      })).resolves.toBeNull();
    });

    it('fails open to the normal checkout path when the lookup throws', async () => {
      mockFindPending.mockRejectedValue(new Error('database unavailable'));
      await expect(tryReusePendingOrder({
        userId: 'user-1', tier: 'BASIC', period: 'monthly', paymentMethod: 'nowpayments',
      })).resolves.toBeNull();
    });
  });

  describe('tryHandleFreePromoOrder', () => {
    const params = {
      userId: 'user-1', tier: 'BASIC' as const, period: 'monthly' as const,
      promoCode: 'FREE100', customerEmail: 'buyer@example.test',
    };

    it('completes a valid full-discount promo and returns handover details', async () => {
      const response = await tryHandleFreePromoOrder(params);

      expect(response?.status).toBe(200);
      await expect(response?.json()).resolves.toEqual({
        status: 'free_order_completed',
        orderId: 'order-free-1',
        handoverId: 'handover-1',
        magicLink: 'https://example.test/handover',
      });
      expect(mocks.processPromoReservation).toHaveBeenCalledWith({
        promoCode: 'FREE100', userId: 'user-1', tier: 'BASIC',
      });
      expect(mocks.executeFreeOrderHandover).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1', tier: 'BASIC', period: 'monthly', promoCode: 'FREE100',
        customerEmail: 'buyer@example.test', promoDiscountCents: 19_900, promoTrialDays: 0,
      }));
    });

    it.each([
      ['not a free order', { calc: { isFreeOrder: false }, validation: { valid: true, discountType: 'free_full' } }],
      ['not a valid full discount', { calc: { isFreeOrder: true }, validation: { valid: false, discountType: 'percentage' } }],
    ])('returns null when the promo is %s', async (_case, result) => {
      mocks.processPromoReservation.mockResolvedValue({
        promoDiscountCents: 1_000, promoTrialDays: 0, ...result,
      });

      await expect(tryHandleFreePromoOrder(params)).resolves.toBeNull();
      expect(mocks.executeFreeOrderHandover).not.toHaveBeenCalled();
    });

    it('returns a 500 response if free-order handover fails', async () => {
      mocks.executeFreeOrderHandover.mockRejectedValue(new Error('handover write failed'));

      const response = await tryHandleFreePromoOrder(params);

      expect(response?.status).toBe(500);
      await expect(response?.json()).resolves.toEqual({
        error: 'FREE order activation failed: handover write failed',
      });
    });

    it('propagates promo reservation failures to the route error boundary', async () => {
      mocks.processPromoReservation.mockRejectedValue(new Error('promo service unavailable'));

      await expect(tryHandleFreePromoOrder(params)).rejects.toThrow('promo service unavailable');
    });
  });
});
