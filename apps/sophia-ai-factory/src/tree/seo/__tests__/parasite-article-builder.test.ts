/**
 * @file parasite-article-builder.test.ts
 * @description Unit tests for Schema.org JSON-LD & Parasite SEO article compiler
 */

import { describe, it, expect } from 'vitest';
import { compileParasiteArticle, buildProductReviewSchemaOrg } from '../parasite-article-builder';

describe('Parasite SEO Article Builder (Tree Layer)', () => {
  const sampleInput = {
    productName: 'Tai Nghe Bluetooth Pro ANC',
    skuCode: 'SKU-EARBUDS-ANC',
    price: 490000,
    currency: 'VND',
    ratingScore: 4.9,
    reviewCount: 3500,
    targetPlatform: 'MEDIUM' as const,
    cloakedBridgeUrl: 'https://sophia.ai/go/earbuds-pro-deal',
    keyFeatures: ['Chống ồn chủ động 45dB', 'Thời lượng pin 36 tiếng', 'Kết nối Bluetooth 5.4'],
  };

  it('generates valid Schema.org Product JSON-LD', () => {
    const jsonStr = buildProductReviewSchemaOrg(sampleInput);
    const parsed = JSON.parse(jsonStr);

    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('Product');
    expect(parsed.name).toBe('Tai Nghe Bluetooth Pro ANC');
    expect(parsed.offers.price).toBe(490000);
    expect(parsed.aggregateRating.ratingValue).toBe('4.9');
    expect(parsed.aggregateRating.reviewCount).toBe(3500);
  });

  it('compiles SEO article markdown with cloaked bridge links and calculate score', () => {
    const article = compileParasiteArticle(sampleInput);

    expect(article.title).toContain('Tai Nghe Bluetooth Pro ANC');
    expect(article.canonicalSlug).toBe('review-sku-earbuds-anc-medium');
    expect(article.seoContentMarkdown).toContain('https://sophia.ai/go/earbuds-pro-deal');
    expect(article.seoContentMarkdown).toContain('Chống ồn chủ động 45dB');
    expect(article.seoScore).toBeGreaterThanOrEqual(80);
    expect(article.schemaOrgJsonLd).toBeDefined();
  });
});
