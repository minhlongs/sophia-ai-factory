'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Play, Sparkles, Share2, BarChart3 } from 'lucide-react';
import { ScrollReveal } from '@/seed/components/ui/scroll-reveal';
import { Link } from '@/navigation';

interface Feature {
  key: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const FEATURES: Feature[] = [
  { key: 'scriptWriting', icon: Sparkles },
  { key: 'multiChannel', icon: Share2 },
  { key: 'analytics', icon: BarChart3 },
];

export default function LandingHero() {
  const t = useTranslations('stitch.landing');

  return (
    <>
      <main
        className="relative min-h-screen pt-24 flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 50% -20%, hsl(var(--primary) / 0.15) 0%, rgba(14, 14, 18, 0) 60%)',
        }}
      >
        {/* Background decoration */}
        <div
          className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none"
          aria-hidden="true"
        />

        <section className="max-w-7xl mx-auto px-4 md:px-8 w-full flex flex-col items-center text-center space-y-8">
          {/* Badge */}
          <ScrollReveal>
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-primary font-medium text-sm tracking-wide">
                {t('badge')}
              </span>
            </div>
          </ScrollReveal>

          {/* Headline */}
          <ScrollReveal delay={100}>
            <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold leading-tight tracking-tight text-white max-w-4xl"
                style={{textShadow: '0 0 30px hsl(var(--primary) / 0.3)'}}>
              {t('headline')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/80">
                {t('headlineHighlight')}
              </span>
            </h1>
          </ScrollReveal>

          {/* Subheading */}
          <ScrollReveal delay={200}>
            <p className="text-lg md:text-[20px] text-[#A1A1AA] max-w-2xl leading-relaxed">
              {t('subheading')}
            </p>
          </ScrollReveal>

          {/* CTA Buttons */}
          <ScrollReveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center gap-6 mt-4">
              <Link
                href="/auth/signup"
                className="h-12 px-10 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/30 flex items-center justify-center"
              >
                {t('cta.startFree')}
              </Link>
              <button
                type="button"
                className="group h-12 px-8 rounded-xl border border-outline-variant/50 text-white font-medium hover:bg-surface-container-highest transition-all flex items-center justify-center gap-2 active:scale-95"
                aria-label={t('cta.watchDemo')}
              >
                <Play className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" aria-hidden="true" />
                {t('cta.watchDemo')}
              </button>
            </div>
          </ScrollReveal>

          {/* Trust Bar */}
          <ScrollReveal delay={400}>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-12 border-t border-outline-variant/20 w-full max-w-3xl mt-12">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-3" role="list" aria-label={t('trustBar.label')}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center text-[10px] text-white overflow-hidden"
                      role="listitem"
                      aria-hidden="true"
                    />
                  ))}
                  <div
                    className="w-8 h-8 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center bg-primary text-white text-[10px] font-bold"
                    role="listitem"
                  >
                    +10k
                  </div>
                </div>
                <span className="text-sm font-medium text-on-surface-variant">
                  {t('trustBar.creators')}
                </span>
              </div>
              <div className="h-4 w-px bg-outline-variant/40 hidden md:block" aria-hidden="true" />
              <span className="text-sm font-medium text-on-surface-variant">
                {t('trustBar.videos')}
              </span>
              <div className="h-4 w-px bg-outline-variant/40 hidden md:block" aria-hidden="true" />
              <div className="flex items-center gap-1.5">
                <div className="flex text-yellow-500">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="text-sm">★</span>
                  ))}
                </div>
                <span className="text-sm font-medium text-on-surface-variant">4.9/5</span>
              </div>
            </div>
          </ScrollReveal>

          {/* Feature Cards */}
          <ScrollReveal
            delay={500}
            staggerDelay={150}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 pb-20 w-full max-w-6xl text-left"
          >
            {FEATURES.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="group p-6 rounded-2xl border border-zinc-800/50 hover:border-primary/50 transition-all duration-500 text-left"
                style={{
                  background: 'rgba(37, 37, 46, 0.4)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t(`features.${key}.title`)}
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {t(`features.${key}.description`)}
                </p>
              </div>
            ))}
          </ScrollReveal>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="w-full py-12 bg-surface-container-low border-t border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-lg font-headline font-semibold text-on-surface">Sophia AI Factory</span>
            <p className="text-sm text-on-surface-variant">
              {t('footer.copyright')}
            </p>
          </div>
          <nav className="flex items-center gap-8" aria-label="Footer navigation">
            <Link
              href="/privacy"
              className="text-on-surface-variant hover:text-on-surface transition-colors text-sm"
            >
              {t('footer.privacy')}
            </Link>
            <Link
              href="/terms"
              className="text-on-surface-variant hover:text-on-surface transition-colors text-sm"
            >
              {t('footer.terms')}
            </Link>
            <Link
              href="/contact"
              className="text-on-surface-variant hover:text-on-surface transition-colors text-sm"
            >
              {t('footer.contact')}
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
