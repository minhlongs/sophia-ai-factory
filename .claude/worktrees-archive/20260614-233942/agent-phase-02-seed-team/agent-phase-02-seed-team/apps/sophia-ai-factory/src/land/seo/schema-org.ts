/**
 * Schema.org JSON-LD builders for Sophia AI Factory.
 * Each builder returns a plain object — callers inject via <script type="application/ld+json">.
 *
 * Usage:
 *   const schema = buildOrganizationSchema();
 *   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
 */

import { TIER_CONFIGS, TIER_CONFIG } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';

const SITE_URL = 'https://sophia.agencyos.network';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface FaqSchemaItem {
  q: string;
  a: string;
}

export interface BreadcrumbSchemaItem {
  name: string;
  url: string;
}

// ── 1. Organization ───────────────────────────────────────────────────────────

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

// ── 2. FAQPage ────────────────────────────────────────────────────────────────

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

// ── 3. Product (per pricing tier) ─────────────────────────────────────────────

export interface ProductSchema {
  '@context': string;
  '@type': 'Product';
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

export function buildProductSchema(tier: Tier): ProductSchema {
  const config = TIER_CONFIGS[tier];
  const label = TIER_CONFIG[tier].label;
  const features = TIER_CONFIG[tier].features.join(', ');
  const isLifetime = config.price === 4999;
  const priceDisplay = isLifetime
    ? `${config.price} one-time`
    : `${config.price}/month`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `Sophia AI Factory — ${label}`,
    description: `${label} tier: ${features}. ${priceDisplay} USDT.`,
    brand: {
      '@type': 'Brand',
      name: 'Sophia AI Factory',
    },
    offers: {
      '@type': 'Offer',
      price: String(config.price),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing#tier-${label.toLowerCase()}`,
    },
  };
}

/** Build all 4 tier Product schemas in a single array. */
export function buildAllProductSchemas(): ProductSchema[] {
  const tiers: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
  return tiers.map(buildProductSchema);
}

// ── 4. BreadcrumbList ─────────────────────────────────────────────────────────

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
