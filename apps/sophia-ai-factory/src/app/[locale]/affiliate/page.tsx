import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AffiliateLandingView } from './components/affiliate-landing-view';
import { generateAffiliateMetadata } from './components/affiliate-metadata';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return generateAffiliateMetadata((await params).locale);
}

export default async function AffiliateLandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'affiliateProgram' });
  return <AffiliateLandingView signupUrl={`/${locale}/login?ref=affiliate`} t={t} />;
}
