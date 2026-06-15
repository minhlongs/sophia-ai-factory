/**
 * /welcome/[token] — Customer Welcome Page (public, magic-link gated).
 * Shows personalized onboarding with 5 activation steps.
 * Bilingual Vi/En via next-intl.
 *
 * @module app/[locale]/welcome/[token]/page
 */

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { WelcomePageClient } from './welcome-page-client';

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'welcome' });
  return {
    title: t('metadataTitle'),
  };
}

export default async function WelcomePage({ params }: Props) {
  const { locale, token } = await params;

  if (!token || token.length < 32) notFound();

  return <WelcomePageClient token={token} locale={locale} />;
}
