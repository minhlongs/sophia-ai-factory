import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealPaymentService } from './payment-service';
import { polar } from '@/lib/polar';

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

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RealPaymentService();
  });

  it('should create a checkout session successfully', async () => {
    const mockCheckout = {
      id: 'checkout_123',
      url: 'https://sandbox.polar.sh/checkout/checkout_123'
    };

    // getProductIdByTier is no longer used in the service, but we keep the mock if needed for other tests
    // or remove it if not used. The service now expects productIds directly.

    vi.mocked(polar.checkouts.create).mockResolvedValue(mockCheckout as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const params = {
      productIds: [mockProductId],
      successUrl: 'https://example.com/success',
      customerEmail: 'test@example.com',
      metadata: { userId: 'user-1' }
    };

    const result = await service.createCheckoutSession(params);

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

  // This test case is no longer relevant as the service doesn't do tier lookup
  // it('should throw error if Polar Product ID is not found for tier', async () => { ... });

  it('should throw error if Product IDs are missing', async () => {
     const params = {
      productIds: [],
      successUrl: 'https://example.com/success',
      customerEmail: 'test@example.com'
    };

    await expect(service.createCheckoutSession(params)).rejects.toThrow(
      'Missing Polar Product IDs'
    );
  });

  it('should throw error if Polar API fails', async () => {
    vi.mocked(polar.checkouts.create).mockRejectedValue(new Error('API Error'));

    const params = {
      productIds: [mockProductId],
      successUrl: 'https://example.com/success',
      customerEmail: 'test@example.com'
    };

    await expect(service.createCheckoutSession(params)).rejects.toThrow(
      'Failed to create checkout: API Error'
    );
  });
});
