/**
 * Unit tests for WooCommerce REST v3 client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWooCommerceProducts } from '../woocommerce-client';
import { FailureKind } from '@/seed/types/failure-kind';

const mocks = vi.hoisted(() => ({
  shouldAllowRequest: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: mocks.shouldAllowRequest,
  recordSuccess: mocks.recordSuccess,
  recordFailure: mocks.recordFailure,
}));

describe('fetchWooCommerceProducts', () => {
  const originalFetch = globalThis.fetch;
  const sampleConfig = {
    storeUrl: 'https://myshop.example.com',
    consumerKey: 'ck_sample_key',
    consumerSecret: 'cs_sample_secret',
    version: 'wc/v3',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldAllowRequest.mockReturnValue(true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects when circuit breaker is open', async () => {
    mocks.shouldAllowRequest.mockReturnValue(false);

    const res = await fetchWooCommerceProducts(sampleConfig);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(FailureKind.RATE_LIMIT);
      expect(res.error.message).toContain('circuit breaker active');
    }
  });

  it('fetches products successfully with basic authentication', async () => {
    const mockProducts = [
      {
        id: 42,
        name: 'Ergonomic Desk Chair',
        slug: 'ergonomic-desk-chair',
        permalink: 'https://myshop.example.com/product/chair',
        status: 'publish',
        description: '<p>Breathable mesh backing</p>',
        short_description: 'Top rated office chair',
        price: '199.00',
        regular_price: '249.00',
        currency: 'USD',
        categories: [{ id: 1, name: 'Furniture', slug: 'furniture' }],
        tags: [{ id: 10, name: 'office', slug: 'office' }],
        images: [{ id: 101, src: 'https://myshop.example.com/wp-content/uploads/chair.jpg' }],
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockProducts),
    } as unknown as Response);

    const res = await fetchWooCommerceProducts(sampleConfig, { limit: 10 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.length).toBe(1);
      expect(res.value[0].name).toBe('Ergonomic Desk Chair');
      expect(res.value[0].price).toBe('199.00');
    }

    expect(mocks.recordSuccess).toHaveBeenCalledWith('woocommerce', 'myshop.example.com');
  });

  it('records failure on HTTP 403 Forbidden', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    } as unknown as Response);

    const res = await fetchWooCommerceProducts(sampleConfig);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(FailureKind.AUTH_FAILURE);
      expect(res.error.status).toBe(403);
    }

    expect(mocks.recordFailure).toHaveBeenCalledWith(
      'woocommerce',
      FailureKind.AUTH_FAILURE,
      'myshop.example.com'
    );
  });

  it('handles fetch network rejection', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

    const res = await fetchWooCommerceProducts(sampleConfig);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain('ETIMEDOUT');
    }

    expect(mocks.recordFailure).toHaveBeenCalled();
  });
});
