/**
 * Shared public-page Metadata builder for bilingual SEO/OG/Twitter/Canonical parity.
 * Layer: seed/aeo
 */

import type { Metadata } from 'next';
import { SOPHIA_BASE_URL } from './ground-truth-catalog';

export interface PublicPageMetadataInput {
  readonly locale: string;
  readonly path: string;
  readonly title: string;
  readonly description: string;
}

export function buildPublicPageMetadata({
  locale,
  path,
  title,
  description,
}: PublicPageMetadataInput): Metadata {
  const normalizedLocale = locale === 'en' ? 'en' : 'vi';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const cleanPath = normalizedPath === '/' ? '' : normalizedPath;
  const url = `${SOPHIA_BASE_URL}/${normalizedLocale}${cleanPath}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: normalizedLocale === 'vi' ? 'vi_VN' : 'en_US',
      url,
      siteName: 'Sophia AI Factory',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/twitter-card.png'],
    },
    alternates: {
      canonical: url,
      languages: {
        en: `${SOPHIA_BASE_URL}/en${cleanPath}`,
        vi: `${SOPHIA_BASE_URL}/vi${cleanPath}`,
        'x-default': `${SOPHIA_BASE_URL}/en${cleanPath}`,
      },
    },
  };
}
