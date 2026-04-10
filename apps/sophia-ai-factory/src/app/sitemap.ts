/**
 * Dynamic sitemap for SEO — sophia.agencyos.network
 * Next.js generates /sitemap.xml from this file.
 */

import type { MetadataRoute } from 'next';

const BASE_URL = 'https://sophia.agencyos.network';
const LOCALES = ['en', 'vi'];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const staticPages = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/login', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/pricing', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/guide/faq', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/guide/how-it-works', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/guide/integrations', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/guide/telegram', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/affiliate-discovery', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/setup-wizard', priority: 0.4, changeFrequency: 'monthly' as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const page of staticPages) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        lastModified: now,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    }
  }

  return entries;
}
