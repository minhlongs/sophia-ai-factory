'use client';

import React, { useState, useCallback } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { MarketingNav, MarketingFooter } from '@/components/stitch/layouts';
import { cn } from '@/seed/utils/cn';

/* ── Types ──────────────────────────────────────────────────────────────────── */

type BillingPeriod = 'monthly' | 'yearly';
type TierId = 'basic' | 'premium' | 'enterprise' | 'master';

interface PricingTier {
  id: TierId;
  popular: boolean;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  featureCount: number;
}

/* ── Tier data ─────────────────────────────────────────────────────────────── */

const TIERS: PricingTier[] = [
  { id: 'basic', popular: false, monthlyPrice: 29, yearlyPrice: 23, featureCount: 3 },
  { id: 'premium', popular: true, monthlyPrice: 79, yearlyPrice: 63, featureCount: 4 },
  { id: 'enterprise', popular: false, monthlyPrice: 199, yearlyPrice: 159, featureCount: 4 },
  { id: 'master', popular: false, monthlyPrice: null, yearlyPrice: null, featureCount: 3 },
];

const FAQ_INDICES = [0, 1, 2, 3] as const;

export default function PricingPage() {
  const t = useTranslations('stitch.pricingPage');

  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [selectedTier, setSelectedTier] = useState<TierId>('basic');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = useCallback((index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  }, []);

  return (
    <div className="min-h-screen bg-[#08090D] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      <MarketingNav />

      {/* ════ Main Content ════════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-7xl px-6 pt-36 pb-24 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />

        {/* ── Hero Section ─────────────────────────────────────────────────── */}
        <section className="mb-20 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Transparent Pricing
          </div>
          <h1 className="mb-5 text-4xl sm:text-6xl font-black text-white tracking-tight font-display">
            {t('hero.title')}
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-300 leading-relaxed">
            {t('hero.subtitle')}
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center justify-center p-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
            {(['monthly', 'yearly'] as const).map((period) => (
              <label
                key={period}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition-all duration-200 select-none',
                  billing === period
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-slate-400 hover:text-white',
                )}
              >
                <input
                  type="radio"
                  name="billing"
                  value={period}
                  checked={billing === period}
                  onChange={() => setBilling(period)}
                  className="sr-only"
                />
                <span>{t(`billing.${period}`)}</span>
                {period === 'yearly' && (
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {t('billing.savePercent')}
                  </span>
                )}
              </label>
            ))}
          </div>
        </section>

        {/* ── Pricing Grid ─────────────────────────────────────────────────── */}
        <section id="pricing" className="mb-24" aria-label="Pricing plans">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch">
            {TIERS.map((tier) => (
              <PricingCard
                key={tier.id}
                tier={tier}
                billing={billing}
                selectedTier={selectedTier}
                onSelectTier={setSelectedTier}
                t={t}
              />
            ))}
          </div>
        </section>

        {/* ── FAQ Section ──────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mb-10 text-center text-3xl font-black text-white font-display">
            {t('faq.title')}
          </h2>
          <div className="space-y-4">
            {FAQ_INDICES.map((index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#11131E]/80 backdrop-blur-md transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between p-5 text-left focus:outline-none"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span className="text-base font-bold text-white">
                      {t(`faq.items.${index}.question`)}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200',
                        isOpen && 'rotate-180 text-indigo-400',
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
                    <p className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-white/[0.05] pt-3">
                      {t(`faq.items.${index}.answer`)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PricingCard — individual tier card
   ═══════════════════════════════════════════════════════════════════════════════ */

interface PricingCardProps {
  tier: PricingTier;
  billing: BillingPeriod;
  selectedTier: TierId;
  onSelectTier: (id: TierId) => void;
  t: ReturnType<typeof useTranslations>;
}

function PricingCard({ tier, billing, selectedTier, onSelectTier, t }: PricingCardProps) {
  const hasNumericPrice = tier.monthlyPrice !== null;

  const priceNumber = hasNumericPrice
    ? billing === 'monthly'
      ? tier.monthlyPrice
      : tier.yearlyPrice
    : null;

  const features = Array.from(
    { length: tier.featureCount },
    (_, i) => t(`plans.${tier.id}.features.${i}`),
  );

  const isPremium = tier.id === 'premium';
  const isEnterprise = tier.id === 'enterprise';

  const cardClasses = cn(
    'relative flex flex-col rounded-2xl p-8 backdrop-blur-xl',
    'transition-all duration-300',
    isPremium
      ? 'z-10 lg:-translate-y-2 border-2 border-indigo-500/80 bg-gradient-to-b from-[#181B2E] to-[#111320] shadow-2xl shadow-indigo-950/60'
      : 'border border-white/[0.08] bg-[#11131E]/80 hover:border-white/20 hover:-translate-y-1',
  );

  const badgeClasses =
    'absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-1 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-500/40 border border-white/20';

  return (
    <div
      className={cn(cardClasses, isPremium && 'group')}
      role="article"
      aria-label={t(`plans.${tier.id}.name`)}
    >
      {/* Popular Badge */}
      {tier.popular && (
        <div className={badgeClasses} aria-label={t('popular')}>
          ★ {t('popular')}
        </div>
      )}

      {/* Hidden radio for tier selection (E2E test hook) */}
      <input
        type="radio"
        name="tier"
        value={tier.id}
        checked={selectedTier === tier.id}
        onChange={() => onSelectTier(tier.id)}
        className="sr-only"
      />

      {/* Name & Description */}
      <div className="mb-6">
        <h3 className="mb-2 text-xl font-bold text-white">
          {t(`plans.${tier.id}.name`)}
        </h3>
        <p className="text-xs text-slate-400 min-h-[36px] leading-relaxed">
          {t(`plans.${tier.id}.description`)}
        </p>
      </div>

      {/* Price */}
      <div className="mb-8 pb-6 border-b border-white/[0.08]">
        {priceNumber !== null ? (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-slate-400">$</span>
            <span className="text-5xl font-black text-white tracking-tight">{priceNumber}</span>
            <span className="ml-1 text-xs text-slate-400 font-medium">
              {t(`plans.${tier.id}.period`)}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline">
            <span className="text-4xl font-black text-white tracking-tight">
              {t('plans.master.price')}
            </span>
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="mb-8 flex flex-grow flex-col gap-3.5">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3 text-xs text-slate-300">
            <Check
              className="h-4 w-4 flex-shrink-0 text-indigo-400 mt-0.5"
              aria-hidden="true"
            />
            <span className="leading-normal">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <div className="mt-auto">
        <Link
          href={`/register?tier=${tier.id}`}
          className={cn(
            'w-full block text-center rounded-xl py-3.5 text-sm font-bold transition-all active:scale-[0.98]',
            isPremium
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/30 border border-indigo-400/30'
              : isEnterprise
              ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 hover:text-white'
              : 'bg-white/[0.06] border border-white/[0.1] text-slate-200 hover:bg-white/[0.12] hover:text-white',
          )}
        >
          {t(`plans.${tier.id}.cta`)}
        </Link>
      </div>
    </div>
  );
}
