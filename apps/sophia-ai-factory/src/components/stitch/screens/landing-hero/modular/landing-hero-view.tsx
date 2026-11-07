'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { MarketingNav, MarketingFooter } from '@/components/stitch/layouts';
import { HeroHeader } from './hero-header';
import { PipelineMockup } from './pipeline-mockup';
import { WorkflowAndFeatures } from './workflow-and-features';
import { FaqAndCta } from './faq-and-cta';

const SOPHIA_RUNTIMES = [
  'OpenRouter BYOK',
  'ElevenLabs Voice',
  'HeyGen Webhook',
  'PartnerStack S2S',
  'Binance / Bybit / OKX',
  'Telegram Bot',
] as const;

export interface LandingHeroViewProps {
  readonly beforeFooterSlot?: React.ReactNode;
}

export function LandingHeroView({ beforeFooterSlot }: LandingHeroViewProps = {}) {
  const t = useTranslations('stitch.landing');
  const tLanding = useTranslations('landing');

  return (
    <div className="v3-core min-h-screen bg-[#F8F9FC] dark:bg-[#090A10] text-[#0B0F19] dark:text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-200 transition-colors duration-300">
      <MarketingNav />

      <main className="relative pt-32 pb-20 md:pt-44 md:pb-28 overflow-hidden">
        <section id="hero" className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <HeroHeader t={t} />
          <PipelineMockup />

          {/* .v3-core Bottom Runtime & Stack Ticker */}
          <div className="runtimes max-w-5xl w-full text-left">
            <span className="rt-label">{t('v3Core.runtimesLabel')}</span>
            <ul className="rt-list" aria-label={t('v3Core.runtimesLabel')}>
              {SOPHIA_RUNTIMES.map((runtime) => (
                <li key={runtime}>{runtime}</li>
              ))}
            </ul>
          </div>
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
