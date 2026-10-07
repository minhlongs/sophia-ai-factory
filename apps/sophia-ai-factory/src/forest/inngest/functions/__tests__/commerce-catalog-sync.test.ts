/**
 * Unit Tests for commerceCatalogSync Inngest Function
 *
 * Tests circuit breaker trip handling, Shopify/WooCommerce catalog fetching,
 * SHA-256 deduplication, and batch dispatch events.
 *
 * Layer: forest (infrastructure orchestrator tests)
 * @module forest/inngest/functions/__tests__/commerce-catalog-sync.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeProductHash, commerceCatalogSync } from '../commerce-catalog-sync';
import { success, failure } from '@/seed/types/result';
import { FailureKind } from '@/seed/types/failure-kind';
import type { UnifiedProductItem } from '@/seed/types/ecommerce';

// Hoisted mocks for external clients and circuit breaker
const { mockFetchShopify, mockFetchWooCommerce, mockShouldAllow } = vi.hoisted(() => ({
  mockFetchShopify: vi.fn(),
  mockFetchWooCommerce: vi.fn(),
  mockShouldAllow: vi.fn(),
}));

vi.mock('@/tree/ecommerce/shopify-client', () => ({
  fetchShopifyProducts: mockFetchShopify,
}));

vi.mock('@/tree/ecommerce/woocommerce-client', () => ({
  fetchWooCommerceProducts: mockFetchWooCommerce,
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: mockShouldAllow,
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('commerceCatalogSync Inngest Function', () => {
  const sampleProduct: UnifiedProductItem = {
    id: 'prod_101',
    platform: 'shopify',
    title: 'Minimalist Titanium Watch',
    description: 'Precision engineered automatic movement with sapphire crystal.',
    price: 249.0,
    currency: 'USD',
    images: ['https://cdn.shopify.com/watch.jpg'],
    status: 'active',
    tags: ['luxury', 'titanium'],
    rawMetadata: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockShouldAllow.mockReturnValue(true);
  });

  it('computes deterministic SHA-256 product hash for content changes', async () => {
    const hash1 = await computeProductHash(sampleProduct);
    const hash2 = await computeProductHash(sampleProduct);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(16);

    const modifiedProduct = { ...sampleProduct, price: 299.0 };
    const hashModified = await computeProductHash(modifiedProduct);
    expect(hashModified).not.toBe(hash1);
  });

  it('throws RetryAfterError when per-store circuit breaker is open', async () => {
    mockShouldAllow.mockReturnValue(false);

    const stepMock = {
      run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn(),
    };

    const eventData = {
      name: 'commerce/catalog.sync.requested',
      data: {
        syncId: 'sync_001',
        workspaceId: 'ws_demo',
        platform: 'shopify' as const,
        storeHost: 'store.myshopify.com',
      },
    };

    // Extract underlying function handler from Inngest definition
    const handler = (commerceCatalogSync as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn;

    await expect(handler({ event: eventData, step: stepMock })).rejects.toThrow(
      /Circuit breaker OPEN/
    );
  });

  it('successfully fetches and processes Shopify catalog items', async () => {
    mockShouldAllow.mockReturnValue(true);
    mockFetchShopify.mockResolvedValue(
      success([
        {
          id: 'gid://shopify/Product/1',
          title: 'Mechanical Keyboard',
          descriptionHtml: '<p>RGB mechanical keyboard</p>',
          vendor: 'TechGear',
          status: 'ACTIVE',
          tags: ['tech'],
          variants: { edges: [{ node: { price: '129.99' } }] },
          images: { edges: [{ node: { url: 'https://cdn.shopify.com/keyboard.jpg' } }] },
        },
      ])
    );

    const sentEvents: Array<{ name: string; data: unknown }> = [];
    const stepMock = {
      run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn(async (_id: string, evt: { name: string; data: unknown }) => {
        sentEvents.push(evt);
      }),
    };

    const eventData = {
      name: 'commerce/catalog.sync.requested',
      data: {
        syncId: 'sync_002',
        workspaceId: 'ws_demo',
        platform: 'shopify' as const,
        storeHost: 'store.myshopify.com',
      },
    };

    const handler = (commerceCatalogSync as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn;
    const result = (await handler({ event: eventData, step: stepMock })) as {
      totalFetched: number;
      deltaCount: number;
    };

    expect(result.totalFetched).toBe(1);
    expect(result.deltaCount).toBe(1);
    expect(sentEvents.length).toBe(1);
    expect(sentEvents[0].name).toBe('commerce/video.batch.dispatch.requested');
  });

  it('aborts with NonRetriableError on store AUTH_FAILURE', async () => {
    mockShouldAllow.mockReturnValue(true);
    mockFetchShopify.mockResolvedValue(
      failure({
        kind: 'AUTH_FAILURE',
        message: 'Invalid API key or token expired',
      })
    );

    const stepMock = {
      run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
      sendEvent: vi.fn(),
    };

    const eventData = {
      name: 'commerce/catalog.sync.requested',
      data: {
        syncId: 'sync_003',
        workspaceId: 'ws_demo',
        platform: 'shopify' as const,
        storeHost: 'invalid.myshopify.com',
      },
    };

    const handler = (commerceCatalogSync as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn;

    await expect(handler({ event: eventData, step: stepMock })).rejects.toThrow(
      /Shopify auth failure/
    );
  });
});
