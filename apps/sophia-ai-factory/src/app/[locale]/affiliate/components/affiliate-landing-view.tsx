// i18n-namespace: affiliateProgram
import Link from 'next/link';
import { ArrowRight, Coins, Wallet, Cookie } from 'lucide-react';
import { CopyReferralLink } from '@/app/components/affiliate/copy-referral-link';
import { StatCard, StepCard } from './affiliate-cards';

export const EARNINGS_ROWS = [
  { tier: 'Starter', price: '$199/mo', cut: '20%–30% ($39.80 – $59.70/mo)' },
  { tier: 'Growth',  price: '$399/mo', cut: '20%–30% ($79.80 – $119.70/mo)' },
  { tier: 'Premium', price: '$799/mo', cut: '20%–30% ($159.80 – $239.70/mo)' },
  { tier: 'Tier 2 (Sub-Affiliate)', price: 'All Plans', cut: '5% recurring override' },
] as const;

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
      <section className="space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold text-center">{t('earnings.title')}</h2>
        <div className="rounded-xl border border-border bg-card overflow-x-auto max-w-lg mx-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th scope="col" className="px-5 py-3 text-left">{t('earnings.tier_col')}</th>
                <th scope="col" className="px-5 py-3 text-right">{t('earnings.price_col')}</th>
                <th scope="col" className="px-5 py-3 text-right text-emerald-400">{t('earnings.your_cut_col')}</th>
              </tr>
            </thead>
            <tbody>
              {EARNINGS_ROWS.map(({ tier, price, cut }) => (
                <tr key={tier} className="border-t border-border">
                  <td className="px-5 py-3 font-medium text-foreground">{tier}</td>
                  <td className="px-5 py-3 text-muted-foreground text-right">{price}</td>
                  <td className="px-5 py-3 font-semibold text-emerald-400 text-right">{cut}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-5 py-2.5 bg-muted/30 text-[11px] text-muted-foreground">
            {t('earnings.note')}
          </p>
        </div>
      </section>

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

      {/* Legacy "How It Works" section */}
      <section className="space-y-8">
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
              <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
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
