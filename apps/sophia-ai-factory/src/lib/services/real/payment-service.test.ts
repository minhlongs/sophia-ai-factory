import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealPaymentService } from './payment-service';
import { polar } from '@/lib/polar';
import { getProductIdByTier } from '@/lib/polar-config';

// Mock dependencies
vi.mock('@/lib/polar', () => ({
  polar: {
    checkouts: {
      create: vi.fn()
    }
  }
}));

vi.mock('@/lib/polar-config', () => ({
  getProductIdByTier: vi.fn()
}));

describe('RealPaymentService', () => {
  let service: RealPaymentService;
  const mockProductId = 'polar_prod_123';
  const mockTier = 'BASIC';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RealPaymentService();
  });

  it('should create a checkout session successfully', async () => {
    const mockCheckout = {
      id: 'checkout_123',
      url: 'https://sandbox.polar.sh/checkout/checkout_123'
    };

    vi.mocked(getProductIdByTier).mockReturnValue(mockProductId);
    vi.mocked(polar.checkouts.create).mockResolvedValue(mockCheckout as any);

    const params = {
      productId: mockTier,
      successUrl: 'https://example.com/success',
      customerEmail: 'test@example.com',
      metadata: { userId: 'user-1' }
    };

    const result = await service.createCheckoutSession(params);

    expect(getProductIdByTier).toHaveBeenCalledWith(mockTier);
    expect(polar.checkouts.create).toHaveBeenCalledWith({
      products: [mockProductId],
      successUrl: params.successUrl,
      customerEmail: params.customerEmail,
      metadata: params.metadata
    });

    expect(result).toEqual({
      id: mockCheckout.id,
      url: mockCheckout.url
    });
  });

  it('should throw error if Polar Product ID is not found for tier', async () => {
    vi.mocked(getProductIdByTier).mockReturnValue(undefined);

    const params = {
      productId: 'INVALID_TIER',
      successUrl: 'https://example.com/success',
      customerEmail: 'test@example.com'
    };

    await expect(service.createCheckoutSession(params)).rejects.toThrow(
      'Polar Product ID not found for tier: INVALID_TIER'
    );
  });

  it('should throw error if Polar API fails', async () => {
    vi.mocked(getProductIdByTier).mockReturnValue(mockProductId);
    vi.mocked(polar.checkouts.create).mockRejectedValue(new Error('API Error'));

    const params = {
      productId: mockTier,
      successUrl: 'https://example.com/success',
      customerEmail: 'test@example.com'
    };

    await expect(service.createCheckoutSession(params)).rejects.toThrow(
      'Failed to create checkout: API Error'
    );
  });
});
