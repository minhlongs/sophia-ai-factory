/**
 * Dynamic sitemap for SEO — sophia.agencyos.network
 * Next.js generates /sitemap.xml from this file.
 * Excludes auth-gated routes (dashboard, auth, onboarding, welcome, redeem, checkout, payment-success).
 * Blog posts (POSTS array in /blog/page.tsx) redirect via href to existing guide pages,
 * so no per-post canonical URLs to expose. Add per-post entries here only when a
 * standalone /blog/[slug] route exists.
 */

import type { MetadataRoute } from 'next';

const BASE_URL = 'https://sophia.agencyos.network';
const LOCALES = ['en', 'vi'] as const;

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

interface PageEntry {
  path: string;
  priority: number;
  changeFrequency: ChangeFreq;
}

const staticPages: PageEntry[] = [
  // Core marketing — highest priority
  { path: '',                          priority: 1.0, changeFrequency: 'weekly'  },
  { path: '/pricing',                  priority: 0.9, changeFrequency: 'weekly'  },
  // Guide hub + sub-pages
  { path: '/guide',                    priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/faq',                priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/how-it-works',       priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/screens',            priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/integrations',       priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/telegram',           priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/commands',           priority: 0.8, changeFrequency: 'monthly' },
  // Blog & discovery
  { path: '/blog',                     priority: 0.8, changeFrequency: 'weekly'  },
  { path: '/affiliate-discovery',      priority: 0.7, changeFrequency: 'monthly' },
  // Auth entry (indexable login page is fine)
  { path: '/login',                    priority: 0.5, changeFrequency: 'monthly' },
  // Legal & utility
  { path: '/privacy',                  priority: 0.5, changeFrequency: 'monthly' },
  { path: '/terms',                    priority: 0.5, changeFrequency: 'monthly' },
  { path: '/status',                   priority: 0.5, changeFrequency: 'weekly'  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
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
