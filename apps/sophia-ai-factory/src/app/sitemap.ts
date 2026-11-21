/**
 * Dynamic sitemap for SEO, AEO & GEO — sophia.agencyos.network
 * Next.js generates /sitemap.xml from this file.
 * Excludes auth-gated routes (dashboard, admin, auth, onboarding, welcome, checkout).
 */

import type { MetadataRoute } from 'next';
import { getAllBilingualUrls } from '@/seed/aeo';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  // Sitemaps are for indexable HTML pages; machine endpoints (.txt/.json)
  // are advertised via robots.txt and <link rel="alternate">. Exclude /status
  // (JSON API only) and /operations (auth-gated redirect to /login).
  const allUrls = getAllBilingualUrls().filter(
    (url) =>
      !url.endsWith('.txt') &&
      !url.endsWith('.json') &&
      !url.endsWith('/status') &&
      !url.endsWith('/operations')
  );

  return allUrls.map((url) => {
    let priority = 0.7;
    let changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' = 'monthly';

    if (url.endsWith('/pricing') || url.endsWith('/features') || url.endsWith('/solutions')) {
      priority = 0.9;
      changeFrequency = 'weekly';
    } else if (url.endsWith('/vi') || url.endsWith('/en')) {
      priority = 1.0;
      changeFrequency = 'weekly';
    }

    return {
      url,
      lastModified: now,
      changeFrequency,
      priority,
    };
  });
}
