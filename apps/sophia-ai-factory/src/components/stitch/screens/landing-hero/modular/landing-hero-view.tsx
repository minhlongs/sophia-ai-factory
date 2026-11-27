'use client';

import React from 'react';
import { OPTION_A_PILOT_COPY } from '@/seed/config/tiers/option-a-pilot-contract';
import { useTranslations, useLocale } from 'next-intl';
import { MarketingNav, MarketingFooter } from '@/components/stitch/layouts';
import { HeroHeader } from './hero-header';
import { PipelineMockup } from './pipeline-mockup';
import { LandingVideoShowcase } from './landing-video-showcase';
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
  const pilotCopy = OPTION_A_PILOT_COPY[useLocale() === 'vi' ? 'vi' : 'en'];
  const tLanding = useTranslations('landing');

  return (
    <div className="v3-core min-h-screen bg-[var(--background)] text-[var(--on-surface)] selection:bg-[var(--primary)]/30 transition-colors duration-300 motion-reduce:transition-none">
      <MarketingNav />

      <main className="relative overflow-hidden">
        <section id="hero" className="max-w-7xl mx-auto px-6 pt-32 pb-20 md:pt-44 md:pb-28 flex flex-col items-center text-center">
          <HeroHeader t={t} />
      <p className="text-sm text-muted-foreground">{pilotCopy.scope}</p>
      <p className="text-sm text-muted-foreground">{pilotCopy.refund}</p>
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

        <LandingVideoShowcase />

        <WorkflowAndFeatures tLanding={tLanding} t={t} />
        <FaqAndCta t={t} tLanding={tLanding} />

        {beforeFooterSlot}
      </main>
      <MarketingFooter />
    </div>
  );
}

export default LandingHeroView;
