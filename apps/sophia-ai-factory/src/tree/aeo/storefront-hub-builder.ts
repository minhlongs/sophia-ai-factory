/**
 * Public Crypto + SaaS Affiliate Storefront Hub Builder (1-Link Bio).
 *
 * Aggregates a creator's curated `/c/[slug]` GEO reviews, verified `/api/r/[code]`
 * partner links, and `@Sophia_Bbot` Concierge deep-link with HTML-escaped
 * `CollectionPage` JSON-LD and clean Markdown for AI agents.
 *
 * @module tree/aeo/storefront-hub-builder
 */

export interface StorefrontHubItem {
  readonly slug: string;
  readonly title: string;
  readonly vertical: 'saas' | 'crypto';
  readonly summary: string;
  readonly ctaText: string;
  readonly shortUrl: string;
  readonly disclosureTag: string;
}

export interface StorefrontHubProfile {
  readonly handle: string;
  readonly displayName: string;
  readonly bio: string;
  readonly telegramConciergeUrl: string;
  readonly items: readonly StorefrontHubItem[];
}

export const SAFE_HUB_HANDLE_RE = /^[a-z0-9][a-z0-9_-]{1,48}$/i;

export function escapeHubJsonLd(rawJson: string): string {
  return rawJson
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function buildDefaultStorefrontHub(
  handle: string,
  canonicalBaseUrl: string,
): StorefrontHubProfile {
  const base = canonicalBaseUrl.replace(/\/$/, '');
  return {
    handle,
    displayName: `@${handle} — Crypto & SaaS Stack`,
    bio: 'Verified SaaS & Crypto workflow reviews, transparent comparisons, and partner offers (#ad).',
    telegramConciergeUrl: `https://t.me/Sophia_Bbot?start=concierge_${handle}`,
    items: [
      {
        slug: `${handle}-saas-stack`,
        title: 'Recommended B2B SaaS & AI Workflow Stack',
        vertical: 'saas',
        summary: 'Curated recurring-ROI SaaS tools tested for one-person affiliate operations.',
        ctaText: 'View Verified SaaS Review',
        shortUrl: `${base}/api/r/${handle}-saas-stack`,
        disclosureTag: '#ad',
      },
      {
        slug: `${handle}-crypto-tools`,
        title: 'Transparent Crypto Exchange & Analytics Comparison',
        vertical: 'crypto',
        summary: 'Fee structure, security checklist, and official partner links (no profit guarantees).',
        ctaText: 'View Crypto Comparison',
        shortUrl: `${base}/api/r/${handle}-crypto-tools`,
        disclosureTag: '#ad',
      },
    ],
  };
}

export function buildStorefrontHubJsonLd(
  profile: StorefrontHubProfile,
  canonicalBaseUrl: string,
): string {
  const base = canonicalBaseUrl.replace(/\/$/, '');
  const graph = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: profile.displayName,
    description: profile.bio,
    url: `${base}/hub/${profile.handle}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: profile.items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.title,
        url: `${base}/c/${item.slug}`,
      })),
    },
  };
  return escapeHubJsonLd(JSON.stringify(graph, null, 2));
}

export function buildStorefrontHubMarkdown(
  profile: StorefrontHubProfile,
  canonicalBaseUrl: string,
): string {
  const base = canonicalBaseUrl.replace(/\/$/, '');
  const lines = [
    `# ${profile.displayName}`,
    ``,
    `> ${profile.bio}`,
    ``,
    `- **Canonical Hub:** ${base}/hub/${profile.handle}`,
    `- **1-on-1 AI Concierge (Telegram):** ${profile.telegramConciergeUrl}`,
    ``,
    `## Curated Crypto & SaaS Reviews`,
    ``,
  ];

  for (const item of profile.items) {
    lines.push(
      `### ${item.title} (${item.vertical.toUpperCase()})`,
      `${item.summary}`,
      `- GEO Review: ${base}/c/${item.slug}`,
      `- Verified Partner Link (${item.disclosureTag}): [${item.ctaText}](${item.shortUrl})`,
      ``,
    );
  }

  return lines.join('\n');
}
