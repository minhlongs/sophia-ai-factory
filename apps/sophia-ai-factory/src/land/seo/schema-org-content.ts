/**
 * Schema.org Organization, FAQPage and BreadcrumbList JSON-LD builders.
 */

import { SITE_URL } from './schema-org-site';

export interface FaqSchemaItem {
  q: string;
  a: string;
}

export interface BreadcrumbSchemaItem {
  name: string;
  url: string;
}

// ── Organization ──────────────────────────────────────────────────────────────

export interface OrganizationSchema {
  '@context': string;
  '@type': 'Organization';
  name: string;
  url: string;
  logo: string;
  description: string;
  foundingDate: string;
  sameAs: string[];
}

export function buildOrganizationSchema(): OrganizationSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Sophia AI Factory',
    url: SITE_URL,
    // icon-512x512.png is the largest verified public asset; no dedicated logo.png exists
    logo: `${SITE_URL}/icons/icon-512x512.png`,
    description:
      'AI video factory for global creators with USDT payouts and multi-channel publishing.',
    foundingDate: '2025-09',
    sameAs: [
      // Verified: GitHub repo from CLAUDE.md GITHUB_REPO
      'https://github.com/longtho638-jpg/sophia-ai-factory',
      // Verified: Telegram bot from sophia-handover-rules.md
      'https://t.me/Sophia_Bbot',
    ],
  };
}

// ── FAQPage ───────────────────────────────────────────────────────────────────

export interface FaqPageSchema {
  '@context': string;
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }>;
}

export function buildFAQPageSchema(items: FaqSchemaItem[]): FaqPageSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };
}

// ── BreadcrumbList ────────────────────────────────────────────────────────────

export interface BreadcrumbListSchema {
  '@context': string;
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }>;
}

export function buildBreadcrumbSchema(
  items: BreadcrumbSchemaItem[],
): BreadcrumbListSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(({ name, url }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: url,
    })),
  };
}

// ── Pre-built breadcrumbs for common routes ───────────────────────────────────

export const BREADCRUMBS = {
  guideFaq: [
    { name: 'Home', url: SITE_URL },
    { name: 'Guide', url: `${SITE_URL}/guide` },
    { name: 'FAQ', url: `${SITE_URL}/guide/faq` },
  ] satisfies BreadcrumbSchemaItem[],

  pricing: [
    { name: 'Home', url: SITE_URL },
    { name: 'Pricing', url: `${SITE_URL}/pricing` },
  ] satisfies BreadcrumbSchemaItem[],
};
