import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

const SITE_URL = 'https://sophia.agencyos.network';

export async function buildHomeMetadata(locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo.home' });
  const title = t('title');
  const description = t('description');
  const url = locale === 'vi' ? `${SITE_URL}/vi` : `${SITE_URL}/en`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
      url,
      siteName: 'Sophia AI Factory',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Sophia AI Factory' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-image.png'] },
    alternates: {
      canonical: url,
      languages: {
        en: `${SITE_URL}/en`,
        vi: `${SITE_URL}/vi`,
        'x-default': `${SITE_URL}/en`,
      },
    },
  };
}
