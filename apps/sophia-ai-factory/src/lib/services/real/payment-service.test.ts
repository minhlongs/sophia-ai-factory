import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealPaymentService } from './payment-service';
import { createCheckout } from '@lemonsqueezy/lemonsqueezy.js';
import { configureLemonSqueezy } from '@/lib/lemonsqueezy';

// Mock dependencies
vi.mock('@lemonsqueezy/lemonsqueezy.js', () => ({
  createCheckout: vi.fn()
}));

vi.mock('@/lib/lemonsqueezy', () => ({
  configureLemonSqueezy: vi.fn()
}));

describe('RealPaymentService', () => {
  let service: RealPaymentService;
  const mockStoreId = '12345';
  const mockVariantId = '999';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEMONSQUEEZY_STORE_ID = mockStoreId;
    service = new RealPaymentService();
  });

  it('should configure Lemon Squeezy on initialization', () => {
    expect(configureLemonSqueezy).toHaveBeenCalled();
  });

  it('should create a checkout session successfully', async () => {
    const mockResponse = {
      data: {
        data: {
          id: 'checkout-123',
          attributes: {
            url: 'https://checkout.lemonsqueezy.com/checkout-123'
          }
        }
      },
      error: null
    };

    vi.mocked(createCheckout).mockResolvedValue(mockResponse as any);

    const params = {
      productId: mockVariantId,
      successUrl: 'https://example.com/success',
      customerEmail: 'test@example.com',
      metadata: { userId: 'user-1' }
    };

    const result = await service.createCheckoutSession(params);

    expect(createCheckout).toHaveBeenCalledWith(
      parseInt(mockStoreId),
      parseInt(mockVariantId),
      {
        productOptions: {
          redirectUrl: params.successUrl
        },
        checkoutData: {
          email: params.customerEmail,
          custom: params.metadata
        }
      }
    );

    expect(result).toEqual({
      id: 'checkout-123',
      url: 'https://checkout.lemonsqueezy.com/checkout-123'
    });
  });

  it('should throw error if LEMONSQUEEZY_STORE_ID is missing', async () => {
    delete process.env.LEMONSQUEEZY_STORE_ID;

    const params = {
      productId: mockVariantId,
      successUrl: 'https://example.com/success',
      customerEmail: 'test@example.com'
    };

    await expect(service.createCheckoutSession(params)).rejects.toThrow(
      'LEMONSQUEEZY_STORE_ID is not configured'
    );
  });

  it('should throw error if createCheckout returns an error', async () => {
    const mockError = {
      error: {
        message: 'API Error',
        cause: null,
        status: 400
      }
    };

    vi.mocked(createCheckout).mockResolvedValue(mockError as any);

    const params = {
      productId: mockVariantId,
      successUrl: 'https://example.com/success',
      customerEmail: 'test@example.com'
    };

    await expect(service.createCheckoutSession(params)).rejects.toThrow(
      'Failed to create checkout: API Error'
    );
  });

  it('should throw error if checkout URL is missing from response', async () => {
    const mockResponse = {
      data: {
        data: {
          id: 'checkout-123',
          attributes: {
            // url missing
          }
        }
      },
      error: null
    };

    vi.mocked(createCheckout).mockResolvedValue(mockResponse as any);

    const params = {
      productId: mockVariantId,
      successUrl: 'https://example.com/success',
      customerEmail: 'test@example.com'
    };

    await expect(service.createCheckoutSession(params)).rejects.toThrow(
      'Failed to retrieve checkout URL'
    );
  });
});
