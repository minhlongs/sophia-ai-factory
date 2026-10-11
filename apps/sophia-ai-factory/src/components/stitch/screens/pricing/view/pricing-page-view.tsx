'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { MarketingNav, MarketingFooter } from '@/components/stitch/layouts';
import { TIERS, type BillingPeriod, type TierId } from './pricing-types';
import { PricingHero } from './pricing-hero';
import { PricingCard } from './pricing-card';
import { PricingFaq } from './pricing-faq';

export function PricingPageView() {
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

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 pt-36 pb-24 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />

        {/* Hero Section */}
        <PricingHero billing={billing} onBillingChange={setBilling} t={t} />

        {/* Pricing Grid */}
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

        {/* FAQ Section */}
        <PricingFaq openFaq={openFaq} onToggleFaq={toggleFaq} t={t} />
      </main>

      <MarketingFooter />
    </div>
  );
}
