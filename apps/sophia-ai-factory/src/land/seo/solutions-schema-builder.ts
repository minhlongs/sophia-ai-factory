/**
 * Solutions Schema Builder — Multi-Entity Schema.org JSON-LD Generator.
 *
 * Produces an interconnected multi-entity @graph combining:
 * 1. SoftwareApplication (Sophia AI Factory multimedia platform)
 * 2. Product (Industry-specific AI video creation engine)
 * 3. FAQPage (Industry-tailored questions & answers)
 * 4. BreadcrumbList (Home > Solutions > [Industry])
 *
 * Layer: Land (Domain service & SEO data synthesis; imports seed only)
 *
 * @module land/seo/solutions-schema-builder
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const SITE_URL = 'https://sophia.agencyos.network';

export interface SchemaSoftwareApplication {
  '@type': 'SoftwareApplication';
  '@id': string;
  name: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  description: string;
  offers: {
    '@type': 'AggregateOffer';
    priceCurrency: string;
    lowPrice: string;
    highPrice: string;
    offerCount: string;
  };
  featureList: string;
  author: {
    '@type': 'Organization';
    name: string;
    url: string;
  };
}

export interface SchemaProduct {
  '@type': 'Product';
  '@id': string;
  name: string;
  description: string;
  brand: {
    '@type': 'Brand';
    name: string;
  };
  offers: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
    availability: string;
    url: string;
  };
}

export interface SchemaFaqQuestion {
  '@type': 'Question';
  name: string;
  acceptedAnswer: {
    '@type': 'Answer';
    text: string;
  };
}

export interface SchemaFaqPage {
  '@type': 'FAQPage';
  '@id': string;
  mainEntity: SchemaFaqQuestion[];
}

export interface SchemaBreadcrumbListItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
}

export interface SchemaBreadcrumbList {
  '@type': 'BreadcrumbList';
  '@id': string;
  itemListElement: SchemaBreadcrumbListItem[];
}

export interface SolutionsMultiEntityGraph {
  '@context': 'https://schema.org';
  '@graph': [
    SchemaSoftwareApplication,
    SchemaProduct,
    SchemaFaqPage,
    SchemaBreadcrumbList,
  ];
}

export interface SolutionsSchemaInput {
  industry: SolutionIndustry;
  locale: 'en' | 'vi';
  baseUrl?: string;
}

/**
 * Builds the SoftwareApplication entity schema.
 */
export function buildSoftwareApplicationEntity(baseUrl: string = SITE_URL): SchemaSoftwareApplication {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${baseUrl}/#software`,
    name: 'Sophia AI Factory',
    url: baseUrl,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Cloud-based Web Platform (Cloudflare Edge)',
    description:
      'Omnichannel AI video factory for global creators and businesses with multi-channel publishing and automated lead qualification.',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '99',
      highPrice: '4999',
      offerCount: '4',
    },
    featureList:
      'AI Scriptwriting, Multi-channel publishing (TikTok, YouTube Shorts, X), Voice cloning, Referral funnel tracking, Automated Telegram lead qualification, SOLO100 checkout',
    author: {
      '@type': 'Organization',
      name: 'Sophia AI Factory',
      url: baseUrl,
    },
  };
}

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

/**
 * Builds the FAQPage entity schema for a specific industry solution.
 */
export function buildFaqPageEntity(
  industry: SolutionIndustry,
  locale: 'en' | 'vi',
  canonicalUrl: string,
): SchemaFaqPage {
  const isVi = locale === 'vi';
  const questions: SchemaFaqQuestion[] = industry.faqs.map((faq) => ({
    '@type': 'Question',
    name: isVi ? faq.questionVi : faq.questionEn,
    acceptedAnswer: {
      '@type': 'Answer',
      text: isVi ? faq.answerVi : faq.answerEn,
    },
  }));

  return {
    '@type': 'FAQPage',
    '@id': `${canonicalUrl}#faq`,
    mainEntity: questions,
  };
}

/**
 * Builds the BreadcrumbList entity schema for a specific industry solution.
 */
export function buildBreadcrumbListEntity(
  industry: SolutionIndustry,
  locale: 'en' | 'vi',
  baseUrl: string,
  canonicalUrl: string,
): SchemaBreadcrumbList {
  const isVi = locale === 'vi';
  const homeLabel = isVi ? 'Trang chủ' : 'Home';
  const solutionsLabel = isVi ? 'Giải pháp' : 'Solutions';
  const industryLabel = isVi ? industry.nameVi : industry.nameEn;

  const homeUrl = `${baseUrl}/${locale}`;
  const solutionsUrl = `${baseUrl}/${locale}/solutions`;

  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: homeLabel,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: solutionsLabel,
        item: solutionsUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: industryLabel,
        item: canonicalUrl,
      },
    ],
  };
}

/**
 * Builds the composite multi-entity JSON-LD graph combining:
 * SoftwareApplication + Product + FAQPage + BreadcrumbList.
 */
export function buildSolutionsMultiEntitySchema(input: SolutionsSchemaInput): SolutionsMultiEntityGraph {
  const baseUrl = input.baseUrl || SITE_URL;
  const canonicalUrl = `${baseUrl}/${input.locale}/solutions/${input.industry.slug}`;

  const softwareApp = buildSoftwareApplicationEntity(baseUrl);
  const product = buildProductEntity(input.industry, input.locale, canonicalUrl);
  const faqPage = buildFaqPageEntity(input.industry, input.locale, canonicalUrl);
  const breadcrumbList = buildBreadcrumbListEntity(input.industry, input.locale, baseUrl, canonicalUrl);

  return {
    '@context': 'https://schema.org',
    '@graph': [softwareApp, product, faqPage, breadcrumbList],
  };
}
