'use client';

import React, { useState, useCallback } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { Button } from '@/components/stitch';

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

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary-foreground">
      {/* ════ Top Navigation ═══════════════════════════════════════════════════ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-8 md:py-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground" aria-hidden="true">
              S
            </div>
            <span className="text-xl font-black text-foreground">
              Sophia AI Factory
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex md:items-center md:gap-8" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <a
                key={item}
                href="#"
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  item === 'pricing'
                    ? 'font-bold text-primary'
                    : 'text-muted-foreground',
                )}
                aria-current={item === 'pricing' ? 'page' : undefined}
              >
                {t(`nav.${item}`)}
              </a>
            ))}
          </nav>

          {/* Desktop Auth */}
          <div className="hidden items-center gap-4 md:flex">
            <Button variant="ghost" size="sm">
              {t('nav.signIn')}
            </Button>
            <Button variant="primary" size="sm">
              {t('nav.getStarted')}
            </Button>
          </div>

          {/* Mobile Hamburger */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
          >
            <span className="text-2xl">{mobileNavOpen ? '✕' : '☰'}</span>
          </button>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileNavOpen && (
          <nav className="border-t border-border bg-background px-4 py-4 md:hidden" aria-label="Mobile navigation">
            <div className="flex flex-col gap-3">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item}
                  href="#"
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    item === 'pricing'
                      ? 'bg-primary/10 font-bold text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  aria-current={item === 'pricing' ? 'page' : undefined}
                >
                  {t(`nav.${item}`)}
                </a>
              ))}
              <hr className="my-2 border-border" />
              <Button variant="ghost" size="sm" className="w-full justify-start">
                {t('nav.signIn')}
              </Button>
              <Button variant="primary" size="sm" className="w-full">
                {t('nav.getStarted')}
              </Button>
            </div>
          </nav>
        )}
      </header>

      {/* ════ Main Content ════════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-7xl px-4 pt-28 pb-24 md:px-8">
        {/* ── Hero Section ─────────────────────────────────────────────────── */}
        <section className="mb-16 text-center md:mb-20">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-base text-muted-foreground md:text-lg">
            {t('hero.subtitle')}
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <div
              className="inline-flex items-center rounded-full border border-border bg-card p-1"
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
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
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
          <h2 id="faq-heading" className="mb-12 text-center text-3xl font-bold text-foreground">
            {t('faq.title')}
          </h2>
          <div className="space-y-3">
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
                    <span className="text-base font-semibold text-foreground">
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
                    <p className="px-6 pb-4 text-sm leading-relaxed text-muted-foreground">
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
      <footer className="border-t border-border bg-muted/50">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-4 py-12 md:flex-row md:justify-between md:px-8">
          {/* Brand Column */}
          <div className="flex max-w-xs flex-col items-center text-center md:items-start md:text-left">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
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
            <nav className="flex flex-wrap justify-center gap-6" aria-label="Footer navigation">
              {(['privacy', 'terms', 'security', 'status', 'contact'] as const).map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {t(`footer.${link}`)}
                </a>
              ))}
            </nav>
            <p className="text-xs text-muted-foreground">
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
  displayPrice: string;
  t: ReturnType<typeof useTranslations>;
}

function PricingCard({ tier, billing, displayPrice, t }: PricingCardProps) {
  const hasNumericPrice = tier.monthlyPrice !== null;

  const features = Array.from(
    { length: tier.featureCount },
    (_, i) => t(`plans.${tier.id}.features.${i}`),
  );

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-lg border p-8 transition-all duration-300',
        tier.popular
          ? 'z-10 border-2 border-primary bg-card shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30'
          : 'border-border bg-card hover:border-primary/50',
      )}
      role="article"
      aria-label={t(`plans.${tier.id}.name`)}
    >
      {/* Popular Badge */}
      {tier.popular && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-sm"
          aria-label={t('popular')}
        >
          {t('popular')}
        </div>
      )}

      {/* Name & Description */}
      <div className="mb-6">
        <h3 className="mb-1 text-xl font-semibold text-foreground">
          {t(`plans.${tier.id}.name`)}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(`plans.${tier.id}.description`)}
        </p>
      </div>

      {/* Price */}
      <div className="mb-6">
        {hasNumericPrice ? (
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold text-foreground">
              {displayPrice}
            </span>
            <span className="text-sm text-muted-foreground">
              {t(`plans.${tier.id}.period`)}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline">
            <span className="text-5xl font-bold text-foreground">
              {displayPrice}
            </span>
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="mb-10 flex flex-grow flex-col gap-4">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground">
            <Check
              className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-primary"
              aria-hidden="true"
              style={{ fill: 'currentColor' }}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Button
        variant={tier.ctaVariant}
        size="lg"
        fullWidth
      >
        {t(`plans.${tier.id}.cta`)}
      </Button>
    </div>
  );
}
