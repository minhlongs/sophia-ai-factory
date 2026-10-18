// i18n-namespace: affiliateProgram
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { StepCard } from './affiliate-cards';

export const EARNINGS_ROWS = [
  { tier: 'Starter', price: '$199/mo', cut: '20%–30% ($39.80 – $59.70/mo)' },
  { tier: 'Growth',  price: '$399/mo', cut: '20%–30% ($79.80 – $119.70/mo)' },
  { tier: 'Premium', price: '$799/mo', cut: '20%–30% ($159.80 – $239.70/mo)' },
  { tier: 'Tier 2 (Sub-Affiliate)', price: 'All Plans', cut: '5% recurring override' },
] as const;

export function AffiliateEarningsSection({ t }: { t: (key: string) => string }) {
  return (
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
  );
}

export function AffiliateFooterSections({
  signupUrl,
  t,
}: {
  signupUrl: string;
  t: (key: string) => string;
}) {
  return (
    <>
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
    </>
  );
}
