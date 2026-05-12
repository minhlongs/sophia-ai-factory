/**
 * Public /affiliate landing page — affiliate program pitch.
 * Bilingual via next-intl. Static render (revalidate 1h).
 *
 * NOTE: distinct from `/affiliate-discovery` which is the AI-powered offer browser.
 * This page is the inbound "become a Sophia affiliate" funnel.
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Coins, Wallet, Cookie } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
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

export default async function AffiliateLandingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'affiliateProgram' });

  const signupUrl = `/${locale}/login?ref=affiliate`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-20">
      {/* Hero */}
      <section className="text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
          {t('hero.title')}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {t('hero.subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href={signupUrl}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-cyan-500 text-white px-8 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
          >
            {t('hero.ctaPrimary')}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg font-medium border border-border hover:bg-accent transition-colors"
          >
            {t('hero.ctaSecondary')}
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Coins className="w-6 h-6" aria-hidden="true" />}
          value={t('stats.commission')}
          label={t('stats.commissionLabel')}
        />
        <StatCard
          icon={<Wallet className="w-6 h-6" aria-hidden="true" />}
          value={t('stats.payout')}
          label={t('stats.payoutLabel')}
        />
        <StatCard
          icon={<Cookie className="w-6 h-6" aria-hidden="true" />}
          value={t('stats.cookie')}
          label={t('stats.cookieLabel')}
        />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="space-y-8">
        <h2 className="text-2xl md:text-3xl font-bold text-center">{t('howItWorks.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StepCard title={t('howItWorks.step1Title')} description={t('howItWorks.step1Desc')} />
          <StepCard title={t('howItWorks.step2Title')} description={t('howItWorks.step2Desc')} />
          <StepCard title={t('howItWorks.step3Title')} description={t('howItWorks.step3Desc')} />
        </div>
      </section>

      {/* Features */}
      <section className="space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold text-center">{t('features.title')}</h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {(['recurring', 'highEpc', 'transparent', 'noMinimum'] as const).map((key) => (
            <li key={key} className="flex gap-3 items-start">
              <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
              <span className="text-muted-foreground leading-relaxed">{t(`features.${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="text-center space-y-4 py-8 border-t border-border">
        <h2 className="text-2xl md:text-3xl font-bold">{t('cta.title')}</h2>
        <p className="text-muted-foreground">{t('cta.subtitle')}</p>
        <Link
          href={signupUrl}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-cyan-500 text-white px-8 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
        >
          {t('cta.button')}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <p className="text-xs text-muted-foreground pt-4 max-w-md mx-auto">{t('footer.disclaimer')}</p>
      </section>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
      <div className="inline-flex p-2 rounded-lg bg-violet-500/10 text-violet-400">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function StepCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-2">
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
