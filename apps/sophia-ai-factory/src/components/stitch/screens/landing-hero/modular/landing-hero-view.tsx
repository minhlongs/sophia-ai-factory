'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { MarketingNav, MarketingFooter } from '@/components/stitch/layouts';
import { HeroHeader } from './hero-header';
import { PipelineMockup } from './pipeline-mockup';
import { WorkflowAndFeatures } from './workflow-and-features';
import { FaqAndCta } from './faq-and-cta';

export interface LandingHeroViewProps {
  readonly beforeFooterSlot?: React.ReactNode;
}

export function LandingHeroView({ beforeFooterSlot }: LandingHeroViewProps = {}) {
  const t = useTranslations('stitch.landing');
  const tLanding = useTranslations('landing');

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#090A10] text-[#0B0F19] dark:text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-200 transition-colors duration-300">
      <MarketingNav />

      <main className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        <section className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <HeroHeader t={t} />
          <PipelineMockup />
        </section>
      </main>

      <WorkflowAndFeatures tLanding={tLanding} t={t} />
      <FaqAndCta t={t} tLanding={tLanding} />

      {beforeFooterSlot}
      <MarketingFooter />
    </div>
  );
}

export default LandingHeroView;
