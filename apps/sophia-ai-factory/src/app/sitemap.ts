/**
 * Dynamic sitemap for SEO, AEO & GEO — sophia.agencyos.network
 * Next.js generates /sitemap.xml from this file.
 * Excludes auth-gated routes (dashboard, admin, auth, onboarding, welcome, checkout).
 */

import type { MetadataRoute } from 'next';
import { getAllBilingualUrls } from '@/seed/aeo';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  const allUrls = getAllBilingualUrls();

  return allUrls.map((url) => {
    let priority = 0.7;
    let changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' = 'monthly';

    if (url.endsWith('.txt') || url.endsWith('.json')) {
      priority = 0.9;
      changeFrequency = 'weekly';
    } else if (url.endsWith('/pricing') || url.endsWith('/features') || url.endsWith('/solutions')) {
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
