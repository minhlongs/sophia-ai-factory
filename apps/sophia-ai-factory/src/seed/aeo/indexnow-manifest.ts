/**
 * Deterministic IndexNow Key & Sitemaps URL Manifest for Sophia AI Factory.
 * Zero-Operator-Secret doctrine: Crawler domain verification via deterministic public endpoint.
 * Layer: seed/aeo
 */

import { NICHE_SLUGS } from '@/seed/config/niche-list';
import { SOPHIA_BASE_URL } from './ground-truth-catalog';
import type { AeoLocale } from './aeo-types';

export const INDEXNOW_KEY = 'sophia-ai-factory-indexnow-2027';

export const CORE_PUBLIC_PATHS = [
  '',
  '/pricing',
  '/guide',
  '/affiliate',
  '/status',
  '/ai-video',
  '/features',
  '/solutions',
  '/products',
  '/marketplace',
  '/sop-marketplace',
  '/benchmarks',
  '/operations',
  '/partner',
  '/blog',
  '/contact',
  '/terms',
  '/privacy',
  '/affiliate-disclosure',
  '/affiliate-terms',
] as const;

export function getAllBilingualUrls(): string[] {
  const locales: AeoLocale[] = ['vi', 'en'];
  const urls: string[] = [
    `${SOPHIA_BASE_URL}/llms.txt`,
    `${SOPHIA_BASE_URL}/llms-full.txt`,
    `${SOPHIA_BASE_URL}/.well-known/agent.json`,
    `${SOPHIA_BASE_URL}/api/openapi.json`,
  ];

  for (const path of CORE_PUBLIC_PATHS) {
    for (const loc of locales) {
      urls.push(`${SOPHIA_BASE_URL}/${loc}${path}`);
    }
  }

  for (const niche of NICHE_SLUGS) {
    for (const loc of locales) {
      urls.push(`${SOPHIA_BASE_URL}/${loc}/ai-video/${niche}`);
    }
  }

  return urls;
}

export function buildIndexNowSubmissionPayload() {
  return {
    host: 'sophia.agencyos.network',
    key: INDEXNOW_KEY,
    keyLocation: `${SOPHIA_BASE_URL}/api/aeo/indexnow`,
    urlList: getAllBilingualUrls(),
  };
}
