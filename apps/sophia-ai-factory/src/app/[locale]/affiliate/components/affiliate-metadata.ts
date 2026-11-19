import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

const SITE_URL = 'https://sophia.agencyos.network';

export async function generateAffiliateMetadata(locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'affiliateProgram' });
  const title = t('meta.title');
  const description = t('meta.description');
  const url = `${SITE_URL}/${locale}/affiliate`;

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
        en: `${SITE_URL}/en/affiliate`,
        vi: `${SITE_URL}/vi/affiliate`,
        'x-default': `${SITE_URL}/en/affiliate`,
      },
    },
  };
}
