/**
 * Dynamic sitemap for SEO, AEO & GEO — sophia.agencyos.network
 * Next.js generates /sitemap.xml from this file.
 * Excludes auth-gated routes (dashboard, auth, onboarding, welcome, redeem, checkout, payment-success).
 */

import type { MetadataRoute } from 'next';
import { NICHE_SLUGS } from '@/seed/config/niche-list';

const BASE_URL = 'https://sophia.agencyos.network';
const LOCALES = ['en', 'vi'] as const;

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

interface PageEntry {
  path: string;
  priority: number;
  changeFrequency: ChangeFreq;
}

const staticPages: PageEntry[] = [
  { path: '',                          priority: 1.0, changeFrequency: 'weekly'  },
  { path: '/pricing',                  priority: 0.9, changeFrequency: 'weekly'  },
  { path: '/guide',                    priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/faq',                priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/how-it-works',       priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/screens',            priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/integrations',       priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/telegram',           priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide/commands',           priority: 0.8, changeFrequency: 'monthly' },
  { path: '/blog',                     priority: 0.8, changeFrequency: 'weekly'  },
  { path: '/affiliate-discovery',      priority: 0.7, changeFrequency: 'monthly' },
  { path: '/affiliate',                priority: 0.8, changeFrequency: 'monthly' },
  { path: '/ai-video',                 priority: 0.9, changeFrequency: 'weekly'  },
  { path: '/login',                    priority: 0.5, changeFrequency: 'monthly' },
  { path: '/privacy',                  priority: 0.5, changeFrequency: 'monthly' },
  { path: '/terms',                    priority: 0.5, changeFrequency: 'monthly' },
  { path: '/status',                   priority: 0.5, changeFrequency: 'weekly'  },
];

const aeoRootEndpoints: PageEntry[] = [
  { path: '/llms.txt',                 priority: 0.9, changeFrequency: 'weekly'  },
  { path: '/llms-full.txt',            priority: 0.9, changeFrequency: 'weekly'  },
  { path: '/.well-known/agent.json',   priority: 0.8, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  const entries: MetadataRoute.Sitemap = [];

  for (const endpoint of aeoRootEndpoints) {
    entries.push({
      url: `${BASE_URL}${endpoint.path}`,
      lastModified: now,
      changeFrequency: endpoint.changeFrequency,
      priority: endpoint.priority,
    });
  }

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

  // AI video niche landing pages — 51 niches × 2 locales
  for (const niche of NICHE_SLUGS) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}/ai-video/${niche}`,
        lastModified: now,
        changeFrequency: 'monthly' as ChangeFreq,
        priority: 0.7,
      });
    }
  }

  return entries;
}
