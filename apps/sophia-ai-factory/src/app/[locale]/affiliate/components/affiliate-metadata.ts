import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateAffiliateMetadata(locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'affiliateProgram' });
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical: `/${locale}/affiliate`,
      languages: { en: '/en/affiliate', vi: '/vi/affiliate' },
    },
  };
}
