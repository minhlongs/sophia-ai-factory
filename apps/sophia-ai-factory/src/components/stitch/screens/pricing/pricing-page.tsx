'use client';

import React, { useState, useCallback } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
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

/* ── Tier data (prices stay in code; text from translation) ─────────────────── */

const TIERS: PricingTier[] = [
  { id: 'basic', popular: false, monthlyPrice: 29, yearlyPrice: 23, featureCount: 3 },
  { id: 'premium', popular: true, monthlyPrice: 79, yearlyPrice: 63, featureCount: 4 },
  { id: 'enterprise', popular: false, monthlyPrice: 199, yearlyPrice: 159, featureCount: 4 },
  { id: 'master', popular: false, monthlyPrice: null, yearlyPrice: null, featureCount: 3 },
];

/* ── FAQ indices ────────────────────────────────────────────────────────────── */

const FAQ_INDICES = [0, 1, 2, 3] as const;

/* ═══════════════════════════════════════════════════════════════════════════════
   PricingPage
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function PricingPage() {
  const t = useTranslations('stitch.pricingPage');

  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = useCallback((index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary-container selection:text-on-primary-container">
      {/* ════ Main Content ════════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-7xl px-6 pt-32 pb-24">
        {/* ── Hero Section ─────────────────────────────────────────────────── */}
        <section className="mb-20 text-center">
          <h1 className="mb-4 text-5xl font-bold text-foreground md:text-[48px]">
            {t('hero.title')}
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-[18px] text-muted-foreground">
            {t('hero.subtitle')}
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <div
              className="inline-flex h-[48px] items-center rounded-full border border-border bg-card p-1"
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
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(`billing.${period}`)}
                  {period === 'yearly' && (
                    <span className="ml-1 text-xs font-bold">
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
                t={t}
              />
            ))}
          </div>
        </section>

        {/* ── FAQ Section ──────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mb-12 text-center text-3xl font-bold text-foreground">
            {t('faq.title')}
          </h2>
          <div className="space-y-4">
            {FAQ_INDICES.map((index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span className="text-[16px] font-semibold text-foreground">
                      {t(`faq.items.${index}.question`)}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-300',
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
                    <p className="px-6 pb-4 text-sm text-muted-foreground">
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
      <footer className="border-t border-border bg-muted">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-8 py-12 md:flex-row md:justify-between">
          {/* Brand Column */}
          <div className="flex max-w-xs flex-col items-center text-center md:items-start md:text-left">
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
                aria-hidden="true"
              >
                S
              </div>
              <span className="text-lg font-bold text-foreground">
                Sophia AI Factory
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('footer.description')}
            </p>
          </div>

          {/* Links Column */}
          <div className="flex flex-col items-center gap-6 md:items-end">
            <nav className="flex flex-wrap justify-center gap-8" aria-label="Footer navigation">
              {(['privacy', 'terms', 'security', 'status', 'contact'] as const).map((link) => (
                <Link
                  key={link}
                  href="#"
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {t(`footer.${link}`)}
                </Link>
              ))}
            </nav>
            <p className="text-sm text-muted-foreground">
              {t('footer.copyright')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PricingCard — individual tier card
   ═══════════════════════════════════════════════════════════════════════════════ */

interface PricingCardProps {
  tier: PricingTier;
  billing: BillingPeriod;
  t: ReturnType<typeof useTranslations>;
}

function PricingCard({ tier, billing, t }: PricingCardProps) {
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
    'relative flex flex-col rounded-lg p-8',
    'transition-all duration-300',
    isPremium
      ? 'z-10 scale-105 border-2 border-primary shadow-lg shadow-primary/20'
      : 'border border-border hover:border-primary/50',
  );

  const badgeClasses =
    'absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-sm';

  return (
    <div
      className={cn(cardClasses, isPremium && 'group')}
      role="article"
      aria-label={t(`plans.${tier.id}.name`)}
    >
      {/* Glow effect for premium card (replaces CSS pseudo-element) */}
      {isPremium && (
        <div
          className="pointer-events-none absolute -inset-[1px] -z-10 rounded-lg bg-gradient-to-br from-transparent via-primary to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-50"
          aria-hidden="true"
        />
      )}

      {/* Popular Badge */}
      {tier.popular && (
        <div className={badgeClasses} aria-label={t('popular')}>
          {t('popular')}
        </div>
      )}

      {/* Name & Description */}
      <div className="mb-8">
        <h3 className="mb-2 text-[20px] font-semibold text-foreground">
          {t(`plans.${tier.id}.name`)}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(`plans.${tier.id}.description`)}
        </p>
      </div>

      {/* Price */}
      <div className="mb-8">
        {priceNumber !== null ? (
          <div className="flex items-baseline gap-0">
            <span className="text-4xl font-bold text-foreground">$</span>
            <span className="text-5xl font-bold text-foreground">{priceNumber}</span>
            <span className="ml-1 text-sm text-muted-foreground">
              {t(`plans.${tier.id}.period`)}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline">
            <span className="text-5xl font-bold text-foreground">
              {t('plans.master.price')}
            </span>
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="mb-10 flex flex-grow flex-col gap-4">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-3 text-sm text-muted-foreground">
            <Check
              className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      {isPremium ? (
        <button
          className={cn(
            'w-full rounded-lg px-4 py-3 text-sm font-bold transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/80',
            'shadow-lg shadow-primary/20',
          )}
        >
          {t(`plans.${tier.id}.cta`)}
        </button>
      ) : isEnterprise ? (
        <button
          className={cn(
            'w-full rounded-lg border px-4 py-3 text-sm font-semibold transition-colors',
            'border-primary text-primary hover:bg-primary/10',
          )}
        >
          {t(`plans.${tier.id}.cta`)}
        </button>
      ) : (
        <button
          className={cn(
            'w-full rounded-lg border px-4 py-3 text-sm font-semibold transition-colors',
            'border-border text-foreground hover:bg-card',
          )}
        >
          {t(`plans.${tier.id}.cta`)}
        </button>
      )}
    </div>
  );
}
