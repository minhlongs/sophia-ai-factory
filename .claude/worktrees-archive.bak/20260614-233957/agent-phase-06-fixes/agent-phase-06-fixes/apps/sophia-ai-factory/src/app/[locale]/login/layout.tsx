import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const title = t('seo.login.title');
  const description = t('seo.login.description');
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website' },
  };
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
