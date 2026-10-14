import type { SolutionIndustry } from '@/seed/types/solutions-types';
import type { SchemaProduct } from './types';

/**
 * Builds the Product entity schema for a specific industry solution.
 */
export function buildProductEntity(
  industry: SolutionIndustry,
  locale: 'en' | 'vi',
  canonicalUrl: string,
): SchemaProduct {
  const isVi = locale === 'vi';
  const name = isVi
    ? `Giải Pháp Video AI Cho Ngành ${industry.nameVi} — Sophia AI Factory`
    : `Sophia AI Video Engine for ${industry.nameEn}`;
  const description = isVi ? industry.heroSubheadlineVi : industry.heroSubheadlineEn;

  return {
    '@type': 'Product',
    '@id': `${canonicalUrl}#product`,
    name,
    description,
    brand: {
      '@type': 'Brand',
      name: 'Sophia AI Factory',
    },
    offers: {
      '@type': 'Offer',
      price: String(industry.roiComparison.sophiaMonthlyUsd),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
    },
  };
}
