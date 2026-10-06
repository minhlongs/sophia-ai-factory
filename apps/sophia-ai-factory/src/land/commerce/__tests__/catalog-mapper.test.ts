/**
 * Unit tests for E-Commerce catalog mapper and prompt builder
 */

import { describe, it, expect } from 'vitest';
import {
  mapShopifyProductToUnified,
  mapWooCommerceProductToUnified,
  buildProductVideoPrompt,
  stripHtml,
} from '../catalog-mapper';

describe('catalog-mapper', () => {
  it('stripHtml cleans HTML markup and decodes entities', () => {
    const raw = '<p>Hello <b>World</b>&nbsp;&amp;&nbsp;&quot;Sophia&quot;&#39;s</p>';
    expect(stripHtml(raw)).toBe('Hello World & "Sophia"\'s');
  });

  it('maps Shopify GraphQL node correctly into UnifiedProductItem', () => {
    const node = {
      id: 'gid://shopify/Product/1234',
      title: ' Smart Watch Pro ',
      descriptionHtml: '<p>Track your health 24/7 &amp; sleep better.</p>',
      vendor: 'TechCo',
      productType: 'Wearables',
      status: 'ACTIVE',
      tags: ['smartwatch', 'fitness', 'tech'],
      onlineStoreUrl: 'https://myshop.com/smartwatch',
      variants: {
        edges: [{ node: { price: '89.95' } }],
      },
      images: {
        edges: [
          { node: { url: 'https://cdn.shopify.com/watch-front.jpg' } },
          { node: { url: 'https://cdn.shopify.com/watch-side.jpg' } },
        ],
      },
    };

    const unified = mapShopifyProductToUnified(node);
    expect(unified.id).toBe('gid://shopify/Product/1234');
    expect(unified.platform).toBe('shopify');
    expect(unified.title).toBe('Smart Watch Pro');
    expect(unified.description).toBe('Track your health 24/7 & sleep better.');
    expect(unified.price).toBe(89.95);
    expect(unified.currency).toBe('USD');
    expect(unified.status).toBe('active');
    expect(unified.images).toHaveLength(2);
    expect(unified.tags).toContain('fitness');
  });

  it('maps WooCommerce payload correctly into UnifiedProductItem', () => {
    const payload = {
      id: 998,
      name: 'Organic Arabica Coffee',
      slug: 'organic-arabica-coffee',
      permalink: 'https://coffee.shop/product/arabica',
      status: 'publish',
      description: '<p>Freshly roasted single-origin beans.</p>',
      short_description: 'Rich dark roast aroma.',
      price: '18.50',
      regular_price: '22.00',
      currency: 'VND',
      categories: [{ id: 5, name: 'Beverages', slug: 'beverages' }],
      tags: [{ id: 12, name: 'coffee', slug: 'coffee' }],
      images: [{ id: 1, src: 'https://coffee.shop/wp-content/uploads/beans.jpg' }],
    };

    const unified = mapWooCommerceProductToUnified(payload);
    expect(unified.id).toBe('998');
    expect(unified.platform).toBe('woocommerce');
    expect(unified.title).toBe('Organic Arabica Coffee');
    expect(unified.price).toBe(18.50);
    expect(unified.currency).toBe('VND');
    expect(unified.status).toBe('active');
    expect(unified.handle).toBe('organic-arabica-coffee');
  });

  it('buildProductVideoPrompt constructs compelling video creative parameters', () => {
    const product = {
      id: 'prod_1',
      platform: 'shopify' as const,
      title: 'Portable Espresso Maker',
      description: 'Brew cafe-quality espresso anywhere in under a minute. Compact lightweight design. Easy to clean.',
      tags: ['coffee', 'travel', 'gadgets'],
      price: 65,
      currency: 'USD',
      images: ['https://example.com/espresso.jpg'],
      status: 'active' as const,
      rawMetadata: {},
    };

    const prompt = buildProductVideoPrompt(product);
    expect(prompt.productId).toBe('prod_1');
    expect(prompt.productTitle).toBe('Portable Espresso Maker');
    expect(prompt.headlineHook).toContain('Stop scrolling!');
    expect(prompt.headlineHook).toContain('$65.00');
    expect(prompt.sellingPoints.length).toBeGreaterThan(0);
    expect(prompt.suggestedChannels).toEqual(['tiktok', 'youtube_shorts', 'facebook_reels']);
    expect(prompt.targetAudience).toContain('coffee');
  });
});
