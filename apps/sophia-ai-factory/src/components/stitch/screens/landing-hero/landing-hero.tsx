'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Play, Sparkles, Share2, BarChart3 } from 'lucide-react';
import { ScrollReveal } from '@/seed/components/ui/scroll-reveal';
import { Link } from '@/navigation';

const NAV_ITEMS = ['features', 'pricing', 'blog', 'affiliates'] as const;

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
      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0e0e12]/80 backdrop-blur-md border-b border-[#484750]">
        <nav
          className="flex justify-between items-center w-full px-4 md:px-8 py-4 max-w-7xl mx-auto"
          aria-label="Main navigation"
        >
          {/* Brand */}
          <Link
            href="/"
            className="text-2xl font-headline-xl font-bold text-[#D97706] tracking-tighter"
          >
            Sophia
          </Link>

          {/* Nav Links - Desktop */}
          <div className="hidden md:flex gap-8 items-center">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item}
                href={`#${item}`}
                className="text-[#acaab5] hover:text-[#e7e4f0] transition-colors text-sm font-medium"
              >
                {t(`nav.${item}`)}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 md:gap-6">
            <Link
              href="/auth/login"
              className="text-[#acaab5] hover:text-[#e7e4f0] transition-colors text-sm font-medium"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center bg-[#D97706] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-all active:scale-95"
            >
              {t('nav.startFree')}
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero Section ───────────────────────────────────────────────────── */}
      <main className="relative pt-32 pb-24 overflow-hidden">
        {/* Background ambient glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none -z-10"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(217, 119, 6, 0.1) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        <section className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col items-center text-center">
          {/* Badge */}
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D97706]/10 border border-[#D97706]/20 mb-8">
              <span
                className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse"
                aria-hidden="true"
              />
              <span className="text-xs font-bold uppercase tracking-widest text-[#D97706]">
                {t('badge')}
              </span>
            </div>
          </ScrollReveal>

          {/* Headline */}
          <ScrollReveal delay={100}>
            <h1 className="text-4xl md:text-5xl lg:text-[64px] font-headline-xl leading-[1.1] mb-6 tracking-tight max-w-[900px] text-[#e7e4f0]">
              {t('headline')}{' '}
              <span className="text-[#D97706] italic">{t('headlineHighlight')}</span>
            </h1>
          </ScrollReveal>

          {/* Subheading */}
          <ScrollReveal delay={200}>
            <p className="text-lg md:text-xl text-[#acaab5] max-w-[720px] mb-12 leading-relaxed">
              {t('subheading')}
            </p>
          </ScrollReveal>

          {/* CTA Buttons */}
          <ScrollReveal delay={300}>
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Link
                href="/auth/register"
                className="group inline-flex items-center justify-center gap-2 bg-[#D97706] text-white h-12 px-8 rounded-lg font-medium hover:opacity-90 transition-all active:scale-95 shadow-[0_0_20px_rgba(217,119,6,0.4)]"
              >
                {t('cta.startFree')}
                <ArrowRight
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  aria-hidden="true"
                />
              </Link>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 border border-zinc-600 text-[#e7e4f0] h-12 px-8 rounded-lg font-medium hover:bg-zinc-800/50 transition-all active:scale-95"
                aria-label={t('cta.watchDemo')}
              >
                <Play className="w-5 h-5" aria-hidden="true" />
                {t('cta.watchDemo')}
              </button>
            </div>
          </ScrollReveal>

          {/* Trust Bar */}
          <ScrollReveal delay={400}>
            <div className="flex flex-col items-center gap-4 mb-24 py-8 px-8 md:px-12 bg-[#191920]/60 backdrop-blur-lg border border-[#484750]/50 rounded-2xl">
              <div className="flex -space-x-3" role="list" aria-label={t('trustBar.label')}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-[#191920] overflow-hidden bg-gradient-to-br from-[#D97706]/30 to-[#B45309]/30"
                    role="listitem"
                    aria-hidden="true"
                  />
                ))}
                <div
                  className="w-10 h-10 rounded-full border-2 border-[#191920] flex items-center justify-center bg-[#D97706] text-white text-xs font-bold"
                  role="listitem"
                >
                  +10k
                </div>
              </div>
              <p className="text-sm text-[#acaab5]">
                <span className="text-[#e7e4f0] font-semibold">
                  {t('trustBar.creators')}
                </span>{' '}
                · {t('trustBar.videos')}
              </p>
            </div>
          </ScrollReveal>

          {/* Features Grid */}
          <ScrollReveal
            delay={500}
            staggerDelay={150}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left"
          >
            {FEATURES.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="bg-[#18181B] border border-zinc-800 p-4 rounded-lg hover:border-[#D97706]/40 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-[#D97706]/10 flex items-center justify-center mb-6 text-[#D97706] group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-[#e7e4f0]">
                  {t(`features.${key}.title`)}
                </h3>
                <p className="text-[#acaab5] leading-relaxed">
                  {t(`features.${key}.description`)}
                </p>
              </div>
            ))}
          </ScrollReveal>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[#000000] border-t border-[#484750]">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-4 md:px-8 py-12 max-w-7xl mx-auto">
          <div className="flex flex-col items-center md:items-start gap-2 mb-8 md:mb-0">
            <span className="text-xl font-bold text-[#e7e4f0]">
              Sophia
            </span>
            <p className="text-sm text-[#acaab5]">
              {t('footer.copyright')}
            </p>
          </div>
          <nav className="flex gap-8" aria-label="Footer navigation">
            <Link
              href="/privacy"
              className="text-[#acaab5] hover:text-[#D97706] transition-colors text-sm"
            >
              {t('footer.privacy')}
            </Link>
            <Link
              href="/terms"
              className="text-[#acaab5] hover:text-[#D97706] transition-colors text-sm"
            >
              {t('footer.terms')}
            </Link>
            <Link
              href="/contact"
              className="text-[#acaab5] hover:text-[#D97706] transition-colors text-sm"
            >
              {t('footer.contact')}
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
