/**
 * Commerce Catalog Sync Background Inngest Function
 *
 * Orchestrates scheduled and webhook-triggered catalog polling for Shopify
 * and WooCommerce stores with per-store circuit breaker, debounce, and deduplication.
 *
 * Layer: forest (infrastructure orchestrator)
 * @module forest/inngest/functions/commerce-catalog-sync
 */

import { inngest } from '@/seed/inngest/client';
import { NonRetriableError, RetryAfterError } from 'inngest';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { fetchShopifyProducts } from '@/tree/ecommerce/shopify-client';
import { fetchWooCommerceProducts } from '@/tree/ecommerce/woocommerce-client';
import { mapShopifyProductToUnified, mapWooCommerceProductToUnified } from '@/land/commerce/catalog-mapper';
import { logger } from '@/seed/utils/logger-utility';
import type { UnifiedProductItem } from '@/seed/types/ecommerce';

/** Deterministic SHA-256 content hash for change detection */
export async function computeProductHash(product: UnifiedProductItem): Promise<string> {
  const payload = `${product.title}:${product.price}:${product.description.slice(0, 500)}:${product.images[0] ?? ''}`;
  const buffer = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export const commerceCatalogSync = inngest.createFunction(
  {
    id: 'commerce-catalog-sync',
    retries: 3,
    concurrency: { key: 'event.data.storeHost', limit: 1 },
    throttle: { key: 'event.data.storeHost', limit: 2, period: '1s' },
    debounce: { key: 'event.data.storeHost', period: '20s' },
  },
  { event: 'commerce/catalog.sync.requested' },
  async ({ event, step }) => {
    const { syncId, workspaceId, platform, storeHost, limit = 20, query } = event.data;

    // Step 1: Pre-flight per-store circuit breaker
    await step.run('check-store-circuit-breaker', async () => {
      if (!shouldAllowRequest(platform, storeHost)) {
        logger.warn('Circuit breaker OPEN for commerce store', { platform, storeHost, syncId });
        throw new RetryAfterError(`Circuit breaker OPEN for store ${storeHost}`, 30);
      }
      return { allowed: true };
    });

    // Step 2: Fetch and normalize store catalog
    const fetchResult = await step.run('fetch-store-catalog', async () => {
      if (platform === 'shopify') {
        const res = await fetchShopifyProducts(
          { shopDomain: storeHost, accessToken: 'BYOK_STORE_RESOLVED', apiVersion: '2024-04' },
          { limit, query }
        );
        if (!res.ok) {
          recordFailure(platform, res.error.kind, storeHost);
          if (res.error.kind === 'AUTH_FAILURE') {
            throw new NonRetriableError(`Shopify auth failure for ${storeHost}: ${res.error.message}`);
          }
          if (res.error.kind === 'RATE_LIMIT') {
            const retryAfter = res.error.retryAfterSeconds ?? 15;
            throw new RetryAfterError(`Shopify rate limited on ${storeHost}`, retryAfter);
          }
          throw new Error(res.error.message);
        }
        recordSuccess(platform, storeHost);
        return {
          products: res.value.map(mapShopifyProductToUnified),
        };
      }

      // WooCommerce platform
      const res = await fetchWooCommerceProducts(
        { storeUrl: `https://${storeHost}`, consumerKey: 'BYOK', consumerSecret: 'BYOK', version: 'wc/v3' },
        { limit, search: query }
      );
      if (!res.ok) {
        recordFailure(platform, res.error.kind, storeHost);
        if (res.error.kind === 'AUTH_FAILURE') {
          throw new NonRetriableError(`WooCommerce auth failure for ${storeHost}: ${res.error.message}`);
        }
        if (res.error.kind === 'RATE_LIMIT') {
          const retryAfter = res.error.retryAfterSeconds ?? 20;
          throw new RetryAfterError(`WooCommerce rate limited on ${storeHost}`, retryAfter);
        }
        throw new Error(res.error.message);
      }
      recordSuccess(platform, storeHost);
      return {
        products: res.value.map(mapWooCommerceProductToUnified),
      };
    });

    // Step 3: Compute deltas and Chunk-and-Ref return
    const deltas = await step.run('detect-catalog-deltas', async () => {
      const activeProducts = fetchResult.products.filter((p) => p.status === 'active');
      const deltaItems: Array<{ id: string; hash: string }> = [];

      for (const p of activeProducts) {
        const hash = await computeProductHash(p);
        deltaItems.push({ id: p.id, hash });
      }

      return {
        totalFetched: fetchResult.products.length,
        activeCount: activeProducts.length,
        deltaIds: deltaItems.map((d) => d.id),
      };
    });

    // Step 4: Dispatch batch video generation event if active items exist
    if (deltas.deltaIds.length > 0) {
      await step.sendEvent('dispatch-commerce-video-batch', {
        name: 'commerce/video.batch.dispatch.requested',
        data: {
          batchId: `batch_${syncId}_${Date.now()}`,
          workspaceId,
          storeHost,
          products: fetchResult.products.filter((p) => deltas.deltaIds.includes(p.id)),
          autonomyLevel: 1,
        },
      });
    }

    return {
      syncId,
      workspaceId,
      platform,
      storeHost,
      totalFetched: deltas.totalFetched,
      deltaCount: deltas.deltaIds.length,
    };
  }
);
