/**
 * Tests for schema-org.ts JSON-LD builders.
 * Verifies: valid JSON, required fields, correct mapping, ordering.
 */

import { describe, it, expect } from 'vitest';
import {
  buildOrganizationSchema,
  buildFAQPageSchema,
  buildProductSchema,
  buildAllProductSchemas,
  buildBreadcrumbSchema,
  BREADCRUMBS,
} from '@/land/seo/schema-org';

// ── Helper ────────────────────────────────────────────────────────────────────

function roundtrip<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// ── Organization ──────────────────────────────────────────────────────────────

describe('buildOrganizationSchema', () => {
  it('produces valid JSON (roundtrip)', () => {
    const schema = buildOrganizationSchema();
    expect(roundtrip(schema)).toEqual(schema);
  });

  it('has required @context and @type', () => {
    const schema = buildOrganizationSchema();
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Organization');
  });

  it('includes name, url, logo, description', () => {
    const schema = buildOrganizationSchema();
    expect(schema.name).toBe('Sophia AI Factory');
    expect(schema.url).toMatch(/^https?:\/\//);
    expect(schema.logo).toMatch(/\.(png|jpg|svg)$/);
    expect(schema.description.length).toBeGreaterThan(10);
  });

  it('sameAs array contains non-empty strings', () => {
    const { sameAs } = buildOrganizationSchema();
    expect(Array.isArray(sameAs)).toBe(true);
    sameAs.forEach(url => {
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });
  });
});

// ── FAQPage ───────────────────────────────────────────────────────────────────

describe('buildFAQPageSchema', () => {
  const items = [
    { q: 'What is Sophia?', a: 'An AI video factory.' },
    { q: 'How much does it cost?', a: 'Plans start at $199/mo.' },
  ];

  it('produces valid JSON (roundtrip)', () => {
    const schema = buildFAQPageSchema(items);
    expect(roundtrip(schema)).toEqual(schema);
  });

  it('@type is FAQPage', () => {
    expect(buildFAQPageSchema(items)['@type']).toBe('FAQPage');
  });

  it('maps items to mainEntity with correct Question / Answer types', () => {
    const { mainEntity } = buildFAQPageSchema(items);
    expect(mainEntity).toHaveLength(2);
    expect(mainEntity[0]['@type']).toBe('Question');
    expect(mainEntity[0].name).toBe('What is Sophia?');
    expect(mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
    expect(mainEntity[0].acceptedAnswer.text).toBe('An AI video factory.');
  });

  it('handles empty items array', () => {
    const schema = buildFAQPageSchema([]);
    expect(schema.mainEntity).toHaveLength(0);
  });
});

// ── Product ───────────────────────────────────────────────────────────────────

describe('buildProductSchema', () => {
  it('produces valid JSON for all 4 tiers', () => {
    (['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const).forEach(tier => {
      const schema = buildProductSchema(tier);
      expect(roundtrip(schema)).toEqual(schema);
    });
  });

  it('@type is Product', () => {
    expect(buildProductSchema('BASIC')['@type']).toBe('Product');
  });

  it('formats price as string with correct currency', () => {
    const basicSchema = buildProductSchema('BASIC');
    expect(basicSchema.offers.price).toBe('199');
    expect(basicSchema.offers.priceCurrency).toBe('USD');

    const masterSchema = buildProductSchema('MASTER');
    expect(masterSchema.offers.price).toBe('4999');
  });

  it('availability is InStock URL', () => {
    const schema = buildProductSchema('PREMIUM');
    expect(schema.offers.availability).toBe('https://schema.org/InStock');
  });

  it('offer URL contains tier label slug', () => {
    const schema = buildProductSchema('BASIC');
    expect(schema.offers.url).toContain('#tier-');
    expect(schema.offers.url).toMatch(/https:\/\//);
  });

  it('brand is Sophia AI Factory', () => {
    const schema = buildProductSchema('ENTERPRISE');
    expect(schema.brand.name).toBe('Sophia AI Factory');
  });
});

describe('buildAllProductSchemas', () => {
  it('returns exactly 4 products', () => {
    expect(buildAllProductSchemas()).toHaveLength(4);
  });

  it('prices are in ascending order (BASIC < PREMIUM < ENTERPRISE < MASTER)', () => {
    const schemas = buildAllProductSchemas();
    const prices = schemas.map(s => Number(s.offers.price));
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });
});

// ── BreadcrumbList ────────────────────────────────────────────────────────────

describe('buildBreadcrumbSchema', () => {
  it('produces valid JSON (roundtrip)', () => {
    const schema = buildBreadcrumbSchema(BREADCRUMBS.guideFaq);
    expect(roundtrip(schema)).toEqual(schema);
  });

  it('@type is BreadcrumbList', () => {
    expect(buildBreadcrumbSchema(BREADCRUMBS.pricing)['@type']).toBe('BreadcrumbList');
  });

  it('assigns 1-based position in order', () => {
    const { itemListElement } = buildBreadcrumbSchema(BREADCRUMBS.guideFaq);
    expect(itemListElement).toHaveLength(3);
    itemListElement.forEach((el, idx) => {
      expect(el.position).toBe(idx + 1);
      expect(el['@type']).toBe('ListItem');
    });
  });

  it('guideFaq breadcrumb has correct URL sequence', () => {
    const { itemListElement } = buildBreadcrumbSchema(BREADCRUMBS.guideFaq);
    expect(itemListElement[0].item).toMatch(/sophia\.agencyos\.network\/?$/);
    expect(itemListElement[1].item).toContain('/guide');
    expect(itemListElement[2].item).toContain('/guide/faq');
  });
});
