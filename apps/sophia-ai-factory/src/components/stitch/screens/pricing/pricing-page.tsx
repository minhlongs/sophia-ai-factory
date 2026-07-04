'use client';

import React, { useState, useCallback } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';

/* ── Types ──────────────────────────────────────────────────────────────────── */

type BillingPeriod = 'monthly' | 'yearly';
type TierId = 'basic' | 'premium' | 'enterprise' | 'master';

interface PricingTier {
  id: TierId;
  popular: boolean;
  ctaVariant: 'primary' | 'outline';
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  featureCount: number;
}

/* ── Tier data (prices stay in code; text comes from translation) ──────────── */

const TIERS: PricingTier[] = [
  { id: 'basic', popular: false, ctaVariant: 'outline', monthlyPrice: 29, yearlyPrice: 23, featureCount: 3 },
  { id: 'premium', popular: true, ctaVariant: 'primary', monthlyPrice: 79, yearlyPrice: 63, featureCount: 4 },
  { id: 'enterprise', popular: false, ctaVariant: 'outline', monthlyPrice: 199, yearlyPrice: 159, featureCount: 4 },
  { id: 'master', popular: false, ctaVariant: 'outline', monthlyPrice: null, yearlyPrice: null, featureCount: 3 },
];

/* ── Navigation items ─────────────────────────────────────────────────────── */

const NAV_ITEMS = ['models', 'pricing', 'api', 'enterprise'] as const;

/* ── FAQ indices ──────────────────────────────────────────────────────────── */

const FAQ_INDICES = [0, 1, 2, 3] as const;

/* ── Stitch-themed button base classes (replace seed/ui Button) ───────────── */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg ' +
  'transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50';

const BTN: Record<string, string> = {
  primary: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
  ghost: 'bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
  outline: 'bg-transparent border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

/* ═══════════════════════════════════════════════════════════════════════════════
   PricingPage
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function PricingPage() {
  const t = useTranslations('stitch.pricingPage');

  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleFaq = useCallback((index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  }, []);

  const displayPrice = (tier: PricingTier): string => {
    if (tier.monthlyPrice === null) return t('plans.master.price');
    const price = billing === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice;
    return `$${price}`;
  };

  const btnClass = (variant: string, size: string, extra = '') =>
    cn(BTN_BASE, BTN[variant], BTN[size], extra);

  return (
    <div className="min-h-screen bg-[#18181B] text-zinc-100 selection:bg-amber-500/20">
      {/* ════ Top Navigation ═══════════════════════════════════════════════════ */}

      {/* ════ Main Content ════════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-7xl px-4 pt-28 pb-24 md:px-8">
        {/* ── Hero Section ─────────────────────────────────────────────────── */}
        <section className="mb-16 text-center md:mb-20">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-zinc-100 md:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-base text-zinc-400 md:text-lg">
            {t('hero.subtitle')}
          </p>

          {/* Billing Toggle — amber active state */}
          <div className="flex items-center justify-center gap-4">
            <div
              className="inline-flex items-center rounded-full border border-zinc-800 bg-[#18181B] p-1"
              role="radiogroup"
              aria-label="Billing period"
            >
              {(['monthly', 'yearly'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  role="radio"
                  aria-checked={billing === period}
                  onClick={() => setBilling(period)}
                  className={cn(
                    'rounded-full px-6 py-2 text-sm font-semibold transition-all duration-300',
                    billing === period
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  {t(`billing.${period}`)}
                  {period === 'yearly' && (
                    <span className="ml-1 hidden text-xs font-bold md:inline">
                      {t('billing.savePercent')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing Grid ─────────────────────────────────────────────────── */}
        <section className="mb-24" aria-label="Pricing plans">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <PricingCard
                key={tier.id}
                tier={tier}
                billing={billing}
                displayPrice={displayPrice(tier)}
                t={t}
              />
            ))}
          </div>
        </section>

        {/* ── FAQ Section ──────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mb-12 text-center text-3xl font-bold text-zinc-100">
            {t('faq.title')}
          </h2>
          <div className="space-y-3">
            {FAQ_INDICES.map((index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border border-zinc-800 bg-[#18181B]"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span className="text-base font-semibold text-zinc-100">
                      {t(`faq.items.${index}.question`)}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 flex-shrink-0 text-zinc-500 transition-transform duration-300',
                        isOpen && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    id={`faq-answer-${index}`}
                    role="region"
                    className={cn(
                      'overflow-hidden transition-all duration-300 ease-in-out',
                      isOpen ? 'max-h-96' : 'max-h-0',
                    )}
                  >
                    <p className="px-6 pb-4 text-sm leading-relaxed text-zinc-400">
                      {t(`faq.items.${index}.answer`)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ════ Footer ══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-4 py-12 md:flex-row md:justify-between md:px-8">
          {/* Brand Column */}
          <div className="flex max-w-xs flex-col items-center text-center md:items-start md:text-left">
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-bold text-white"
                aria-hidden="true"
              >
                S
              </div>
              <span className="text-lg font-bold text-zinc-100">
                Sophia AI Factory
              </span>
            </div>
            <p className="text-sm text-zinc-400">
              {t('footer.description')}
            </p>
          </div>

          {/* Links Column */}
          <div className="flex flex-col items-center gap-6 md:items-end">
            <nav className="flex flex-wrap justify-center gap-6" aria-label="Footer navigation">
              {(['privacy', 'terms', 'security', 'status', 'contact'] as const).map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-sm text-zinc-400 transition-colors hover:text-amber-500"
                >
                  {t(`footer.${link}`)}
                </a>
              ))}
            </nav>
            <p className="text-xs text-zinc-500">
              {t('footer.copyright')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PricingCard — individual tier card with Stitch amber styling
   ═══════════════════════════════════════════════════════════════════════════════ */

interface PricingCardProps {
  tier: PricingTier;
  billing: BillingPeriod;
  displayPrice: string;
  t: ReturnType<typeof useTranslations>;
}

function PricingCard({ tier, billing, displayPrice, t }: PricingCardProps) {
  const hasNumericPrice = tier.monthlyPrice !== null;

  const features = Array.from(
    { length: tier.featureCount },
    (_, i) => t(`plans.${tier.id}.features.${i}`),
  );

  const cardClasses = cn(
    'relative flex flex-col rounded-lg transition-all duration-300',
    'bg-[#18181B] p-5', // 20px padding for 20px
    tier.popular
      ? 'z-10 border-2 border-amber-500 scale-[1.05] shadow-lg shadow-amber-500/20'
      : 'border border-zinc-800 hover:border-amber-500/50',
  );

  const badgeClasses =
    'absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm';

  const btnClasses = cn(
    BTN_BASE,
    'w-full',
    tier.ctaVariant === 'primary' ? BTN.primary : BTN.outline,
    BTN.lg,
  );

  return (
    <div
      className={cardClasses}
      role="article"
      aria-label={t(`plans.${tier.id}.name`)}
    >
      {/* Popular Badge */}
      {tier.popular && (
        <div className={badgeClasses} aria-label={t('popular')}>
          {t('popular')}
        </div>
      )}

      {/* Name & Description */}
      <div className="mb-6">
        <h3 className="mb-1 text-xl font-semibold text-zinc-100">
          {t(`plans.${tier.id}.name`)}
        </h3>
        <p className="text-sm text-zinc-400">
          {t(`plans.${tier.id}.description`)}
        </p>
      </div>

      {/* Price */}
      <div className="mb-6">
        {hasNumericPrice ? (
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold text-zinc-100">
              {displayPrice}
            </span>
            <span className="text-sm text-zinc-400">
              {t(`plans.${tier.id}.period`)}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline">
            <span className="text-5xl font-bold text-zinc-100">
              {displayPrice}
            </span>
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="mb-10 flex flex-grow flex-col gap-4">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3 text-sm text-zinc-400">
            <Check
              className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-amber-500"
              aria-hidden="true"
              style={{ fill: 'currentColor' }}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA button — amber bg for primary, outline with zinc border for others */}
      <button className={btnClasses}>
        {t(`plans.${tier.id}.cta`)}
      </button>
    </div>
  );
}
