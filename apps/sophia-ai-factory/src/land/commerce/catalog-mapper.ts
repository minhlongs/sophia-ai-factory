/**
 * E-Commerce Catalog Mapper
 *
 * Normalizes raw Shopify and WooCommerce product payloads into UnifiedProductItem
 * and extracts video ad creative parameters (hooks, selling points, CTA).
 *
 * Layer: land (business domain workflow)
 * @module land/commerce/catalog-mapper
 */

import type {
  UnifiedProductItem,
  ProductVideoGenerationPrompt,
} from '@/seed/types/ecommerce';
import type { ShopifyProductNode } from '@/tree/ecommerce/shopify-client';
import type { WooCommerceProductPayload } from '@/tree/ecommerce/woocommerce-client';

/** Strips HTML tags and normalizes whitespace */
export function stripHtml(rawHtml: string): string {
  return rawHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Maps a Shopify GraphQL product node into UnifiedProductItem */
export function mapShopifyProductToUnified(node: ShopifyProductNode): UnifiedProductItem {
  const priceStr = node.variants?.edges?.[0]?.node?.price ?? '0';
  const price = Number.parseFloat(priceStr) || 0;
  const images = (node.images?.edges ?? [])
    .map((e) => e.node.url)
    .filter((url): url is string => Boolean(url && url.startsWith('http')));

  const rawDesc = node.descriptionHtml ?? '';
  const cleanDescription = stripHtml(rawDesc);
  const statusNormalized = node.status.toLowerCase() === 'active' ? 'active' : 'draft';

  return {
    id: node.id,
    platform: 'shopify',
    title: node.title.trim(),
    description: cleanDescription,
    vendor: node.vendor,
    productType: node.productType,
    tags: node.tags ?? [],
    price,
    currency: 'USD',
    images,
    url: node.onlineStoreUrl,
    status: statusNormalized,
    rawMetadata: {
      shopifyId: node.id,
      vendor: node.vendor,
    },
  };
}

/** Maps a WooCommerce REST payload into UnifiedProductItem */
export function mapWooCommerceProductToUnified(item: WooCommerceProductPayload): UnifiedProductItem {
  const price = Number.parseFloat(item.price || item.regular_price || '0') || 0;
  const images = (item.images ?? [])
    .map((img) => img.src)
    .filter((url): url is string => Boolean(url && url.startsWith('http')));

  const desc = item.short_description || item.description || '';
  const cleanDescription = stripHtml(desc);
  const tags = (item.tags ?? []).map((t) => t.name);

  return {
    id: String(item.id),
    platform: 'woocommerce',
    title: item.name.trim(),
    description: cleanDescription,
    vendor: undefined,
    productType: item.categories?.[0]?.name,
    tags,
    price,
    currency: item.currency ?? 'USD',
    images,
    handle: item.slug,
    url: item.permalink,
    status: item.status === 'publish' ? 'active' : 'draft',
    rawMetadata: {
      wooCommerceId: item.id,
      slug: item.slug,
    },
  };
}

/** Generates a tailored video production prompt from unified product attributes */
export function buildProductVideoPrompt(product: UnifiedProductItem): ProductVideoGenerationPrompt {
  const shortTitle = product.title.length > 50 ? `${product.title.slice(0, 47)}...` : product.title;
  const priceFormatted = product.price > 0 ? `$${product.price.toFixed(2)}` : 'Exclusive Offer';

  const headlineHook = `Stop scrolling! Discover ${shortTitle} — now available for ${priceFormatted}.`;

  const sellingPoints: string[] = [];
  if (product.description) {
    const sentences = product.description.split(/[.!?]/).map((s) => s.trim()).filter(Boolean);
    sellingPoints.push(...sentences.slice(0, 3));
  }
  if (sellingPoints.length === 0) {
    sellingPoints.push(`Premium quality ${product.title}`);
    sellingPoints.push(`Direct-to-consumer value at ${priceFormatted}`);
    sellingPoints.push('Fast global shipping and satisfaction guaranteed');
  }

  const callToAction = product.url
    ? `Click the link in bio to shop ${shortTitle} today!`
    : `Order ${shortTitle} online while supplies last!`;

  const targetAudience = product.tags.length > 0
    ? `Interested in ${product.tags.slice(0, 4).join(', ')}`
    : 'Online shoppers seeking quality and innovative products';

  return {
    productId: product.id,
    productTitle: product.title,
    headlineHook,
    sellingPoints,
    callToAction,
    recommendedDurationSeconds: 30,
    visualAssetUrls: product.images.slice(0, 4),
    targetAudience,
    suggestedChannels: ['tiktok', 'youtube_shorts', 'facebook_reels'],
  };
}
