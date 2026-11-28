import { setRequestLocale, getTranslations } from 'next-intl/server';
import { buildCorePagePayload } from '@/seed/aeo';
import { normalizeAeoLocale } from '@/tree/aeo';
import { DualReadPageSection } from '@/forest/components/aeo';
import { MarketingNav } from '@/components/stitch/layouts/marketing-nav';
import { MarketingFooter } from '@/components/stitch/layouts/marketing-footer';
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
  const aeoPayload = buildCorePagePayload('affiliate', normalizeAeoLocale(locale));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MarketingNav />
      <div className="h-24 shrink-0" aria-hidden="true" />
      <AffiliateLandingView
        signupUrl={`/${locale}/signup?next=/${locale}/affiliate/join`}
        t={t}
        beforeFooterSlot={<DualReadPageSection payload={aeoPayload} />}
      />
      <MarketingFooter />
    </div>
  );
}
