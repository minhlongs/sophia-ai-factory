/**
 * Unit tests for Shopify Admin GraphQL client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchShopifyProducts } from '../shopify-client';
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

describe('fetchShopifyProducts', () => {
  const originalFetch = globalThis.fetch;
  const sampleConfig = {
    shopDomain: 'mystore.myshopify.com',
    accessToken: 'shpat_test_token_123',
    apiVersion: '2024-04',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldAllowRequest.mockReturnValue(true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects immediately when circuit breaker is open', async () => {
    mocks.shouldAllowRequest.mockReturnValue(false);

    const res = await fetchShopifyProducts(sampleConfig);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(FailureKind.RATE_LIMIT);
      expect(res.error.message).toContain('circuit breaker active');
    }
  });

  it('fetches products successfully via GraphQL and records success', async () => {
    const mockGraphQLResponse = {
      data: {
        products: {
          edges: [
            {
              node: {
                id: 'gid://shopify/Product/101',
                title: 'Wireless Gaming Earbuds',
                descriptionHtml: '<p>Ultra-low latency audio</p>',
                vendor: 'AudioGear',
                productType: 'Electronics',
                status: 'ACTIVE',
                tags: ['gaming', 'audio', 'earbuds'],
                onlineStoreUrl: 'https://mystore.com/products/earbuds',
                variants: {
                  edges: [{ node: { price: '49.99' } }],
                },
                images: {
                  edges: [{ node: { url: 'https://cdn.shopify.com/image1.jpg' } }],
                },
              },
            },
          ],
        },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockGraphQLResponse),
    } as unknown as Response);

    const res = await fetchShopifyProducts(sampleConfig, { limit: 5 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.length).toBe(1);
      expect(res.value[0].title).toBe('Wireless Gaming Earbuds');
      expect(res.value[0].variants?.edges[0].node.price).toBe('49.99');
    }

    expect(mocks.recordSuccess).toHaveBeenCalledWith('shopify', 'mystore.myshopify.com');
  });

  it('handles HTTP 401 unauthorized errors and records failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as unknown as Response);

    const res = await fetchShopifyProducts(sampleConfig);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(FailureKind.AUTH_FAILURE);
      expect(res.error.status).toBe(401);
    }

    expect(mocks.recordFailure).toHaveBeenCalledWith(
      'shopify',
      FailureKind.AUTH_FAILURE,
      'mystore.myshopify.com'
    );
  });

  it('handles GraphQL error responses and records server failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        errors: [{ message: 'Access denied to products field' }],
      }),
    } as unknown as Response);

    const res = await fetchShopifyProducts(sampleConfig);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(FailureKind.SERVER_ERROR);
      expect(res.error.message).toContain('Access denied');
    }

    expect(mocks.recordFailure).toHaveBeenCalledWith(
      'shopify',
      FailureKind.SERVER_ERROR,
      'mystore.myshopify.com'
    );
  });

  it('handles network throw gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    const res = await fetchShopifyProducts(sampleConfig);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain('ENOTFOUND');
    }

    expect(mocks.recordFailure).toHaveBeenCalled();
  });
});
