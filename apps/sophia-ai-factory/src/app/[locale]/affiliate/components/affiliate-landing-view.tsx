// i18n-namespace: affiliateProgram
import Link from 'next/link';
import { ArrowRight, Coins, Wallet, Cookie } from 'lucide-react';
import { CopyReferralLink } from '@/app/components/affiliate/copy-referral-link';
import { StatCard, StepCard } from './affiliate-cards';
import {
  EARNINGS_ROWS,
  AffiliateEarningsSection,
  AffiliateFooterSections,
} from './affiliate-landing-sections';

export { EARNINGS_ROWS };

interface AffiliateViewProps {
  signupUrl: string;
  t: (key: string) => string;
}

export function AffiliateLandingView({ signupUrl, t }: AffiliateViewProps) {
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

      {/* Earnings table */}
      <AffiliateEarningsSection t={t} />

      {/* How it works — 3-step onboarding */}
      <section id="how-it-works" className="space-y-8">
        <h2 className="text-2xl md:text-3xl font-bold text-center">{t('onboarding.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StepCard
            step={1}
            title={t('onboarding.step1_title')}
            description={t('onboarding.step1_desc')}
          />
          <StepCard
            step={2}
            title={t('onboarding.step2_title')}
            description={t('onboarding.step2_desc')}
          />
          <StepCard
            step={3}
            title={t('onboarding.step3_title')}
            description={t('onboarding.step3_desc')}
          />
        </div>
      </section>

      {/* Copy Referral Link — client component */}
      <section className="space-y-4 text-center">
        <h2 className="text-2xl font-bold">{t('copyLink.title')}</h2>
        <CopyReferralLink />
      </section>

      <AffiliateFooterSections signupUrl={signupUrl} t={t} />
    </div>
  );
}
