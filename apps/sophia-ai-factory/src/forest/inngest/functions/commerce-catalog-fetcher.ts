/**
 * Product Hash Computation and Delta Detection for Commerce Catalog Sync
 * Layer: forest (infrastructure orchestrator)
 * @module forest/inngest/functions/commerce-catalog-fetcher
 */

import type { UnifiedProductItem } from '@/seed/types/ecommerce';

/** Deterministic SHA-256 content hash for change detection */
export async function computeProductHash(product: UnifiedProductItem): Promise<string> {
  const payload = `${product.title}:${product.price}:${product.description.slice(0, 500)}:${product.images[0] ?? ''}`;
  const buffer = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export async function detectCatalogDeltas(products: UnifiedProductItem[]): Promise<{
  totalFetched: number;
  activeCount: number;
  deltaIds: string[];
}> {
  const activeProducts = products.filter((p) => p.status === 'active');
  const deltaItems: Array<{ id: string; hash: string }> = [];

  for (const p of activeProducts) {
    const hash = await computeProductHash(p);
    deltaItems.push({ id: p.id, hash });
  }

  return {
    totalFetched: products.length,
    activeCount: activeProducts.length,
    deltaIds: deltaItems.map((d) => d.id),
  };
}
