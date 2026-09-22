/**
 * Unit & Integration Tests for solutions-schema-builder.ts
 *
 * Verifies:
 * - Multi-entity graph construction
 * - RFC-compliant JSON-LD serializability
 * - Schema.org type compliance (SoftwareApplication, Product, FAQPage, BreadcrumbList)
 * - Bilingual localization (VI and EN)
 * - Canonical URLs and breadcrumb hierarchy
 */

import { describe, it, expect } from 'vitest';
import {
  buildSolutionsMultiEntitySchema,
  buildSoftwareApplicationEntity,
  buildProductEntity,
  buildFaqPageEntity,
  buildBreadcrumbListEntity,
  SITE_URL,
} from '@/land/seo/solutions-schema-builder';
import { getSolutionIndustry } from '@/seed/config/solutions-catalog';

describe('Solutions Schema Builder', () => {
  const realEstateIndustry = getSolutionIndustry('real-estate');
  const cosmeticsIndustry = getSolutionIndustry('cosmetics');

  it('builds a valid composite JSON-LD graph with 4 entities for English', () => {
    const graph = buildSolutionsMultiEntitySchema({
      industry: realEstateIndustry,
      locale: 'en',
    });

    expect(graph['@context']).toBe('https://schema.org');
    expect(Array.isArray(graph['@graph'])).toBe(true);
    expect(graph['@graph'].length).toBe(4);

    const [software, product, faq, breadcrumbs] = graph['@graph'];

    // 1. SoftwareApplication
    expect(software['@type']).toBe('SoftwareApplication');
    expect(software.name).toBe('Sophia AI Factory');
    expect(software.offers.lowPrice).toBe('99');
    expect(software.offers.highPrice).toBe('4999');

    // 2. Product
    expect(product['@type']).toBe('Product');
    expect(product.name).toContain('Real Estate');
    expect(product.offers.price).toBe('199');
    expect(product.offers.url).toBe(`${SITE_URL}/en/solutions/real-estate`);

    // 3. FAQPage
    expect(faq['@type']).toBe('FAQPage');
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(1);
    expect(faq.mainEntity[0]['@type']).toBe('Question');
    expect(faq.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');

    // 4. BreadcrumbList
    expect(breadcrumbs['@type']).toBe('BreadcrumbList');
    expect(breadcrumbs.itemListElement.length).toBe(3);
    expect(breadcrumbs.itemListElement[0].name).toBe('Home');
    expect(breadcrumbs.itemListElement[1].name).toBe('Solutions');
    expect(breadcrumbs.itemListElement[2].name).toBe('Real Estate');
  });

  it('builds localized Vietnamese entities correctly', () => {
    const graph = buildSolutionsMultiEntitySchema({
      industry: cosmeticsIndustry,
      locale: 'vi',
    });

    const [, product, faq, breadcrumbs] = graph['@graph'];

    // Product name in Vietnamese
    expect(product.name).toContain('Mỹ Phẩm & Thẩm Mỹ');

    // FAQ in Vietnamese
    expect(faq.mainEntity[0].name).toContain('?');
    expect(faq.mainEntity[0].acceptedAnswer.text.length).toBeGreaterThan(10);

    // Breadcrumbs in Vietnamese
    expect(breadcrumbs.itemListElement[0].name).toBe('Trang chủ');
    expect(breadcrumbs.itemListElement[1].name).toBe('Giải pháp');
    expect(breadcrumbs.itemListElement[2].name).toBe('Mỹ Phẩm & Thẩm Mỹ');
    expect(breadcrumbs.itemListElement[2].item).toBe(`${SITE_URL}/vi/solutions/cosmetics`);
  });

  it('is completely JSON-serializable without circular references', () => {
    const graph = buildSolutionsMultiEntitySchema({
      industry: realEstateIndustry,
      locale: 'vi',
    });

    const serialized = JSON.stringify(graph);
    expect(typeof serialized).toBe('string');
    const parsed = JSON.parse(serialized);
    expect(parsed['@graph'].length).toBe(4);
  });

  it('supports custom baseUrl', () => {
    const customBase = 'https://custom-preview.sophia.network';
    const graph = buildSolutionsMultiEntitySchema({
      industry: realEstateIndustry,
      locale: 'en',
      baseUrl: customBase,
    });

    expect(graph['@graph'][0]['@id']).toBe(`${customBase}/#software`);
    expect(graph['@graph'][1]['@id']).toBe(`${customBase}/en/solutions/real-estate#product`);
  });
});
