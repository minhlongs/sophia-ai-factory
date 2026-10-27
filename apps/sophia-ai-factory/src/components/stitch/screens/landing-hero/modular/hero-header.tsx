// i18n-namespace: stitch.landing
import React from 'react';
import { Link } from '@/navigation';
import { ArrowRight, Play } from 'lucide-react';

interface HeroHeaderProps {
  t: (key: string) => string;
}

/**
 * Honest hero: no fabricated creator counts, star ratings, "REC/LIVE" badges
 * or "free/unlimited" claims. The product preview is explicitly illustrative.
 */
export function HeroHeader({ t }: HeroHeaderProps) {
  return (
    <>
      {/* Ambient studio lighting (decorative only) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] pointer-events-none -z-10"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#4338CA]/10 via-[#D97706]/5 to-transparent dark:from-[#6366F1]/18 dark:via-[#F59E0B]/8 dark:to-transparent blur-[140px] rounded-full" />
      </div>

      {/* Capability badge — no LIVE/REC implication */}
      <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] mb-8 shadow-sm">
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wider text-[#4338CA] dark:text-indigo-300">
          {t('badge')}
        </span>
      </div>

      {/* Primary headline — exact VI/EN copy from messages */}
      <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-[1.08] tracking-tight max-w-5xl mb-6 text-[#0B0F19] dark:text-white font-display">
        {t('headline')}
        {t('headlineHighlight') ? (
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4338CA] via-indigo-500 to-[#D97706] dark:from-indigo-400 dark:via-indigo-300 dark:to-[#F59E0B]">
            {t('headlineHighlight')}
          </span>
        ) : null}
      </h1>

      <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mb-4 leading-relaxed font-normal">
        {t('subheading')}
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-3xl mb-10 leading-relaxed">
        {t('controlNote')}
      </p>

      {/* Real CTAs — /register and /guide exist; the demo is labelled illustrative */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 w-full sm:w-auto">
        <Link
          href="/register"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-white bg-[#4338CA] hover:bg-indigo-600 dark:bg-[#6366F1] dark:hover:bg-indigo-500 shadow-lg shadow-[#4338CA]/20 border border-indigo-400/20 transition-all active:scale-[0.98] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <span>{t('cta.startFree')}</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </Link>

        <Link
          href="/guide"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-[#0B0F19] dark:text-slate-200 bg-white hover:bg-slate-50 dark:bg-[#11131F] dark:hover:bg-white/[0.08] border border-[#E2E8F0] dark:border-white/[0.08] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Play className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
          <span>{t('cta.watchDemo')}</span>
        </Link>
      </div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-12">
        {t('demoNote')}
      </p>

      {/* Capability strip — no avatars, stars, creator counts or "7-Level" claims */}
      <div className="studio-glass flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-3.5 px-6 rounded-2xl bg-white/90 dark:bg-[#11131F]/90 border border-[#E2E8F0] dark:border-white/[0.08] mb-20 shadow-lg dark:shadow-2xl">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t('trustBar.label')}
        </span>
        <span className="hidden sm:block h-5 w-[1px] bg-[#E2E8F0] dark:bg-white/10" aria-hidden="true" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t('trustBar.controlContent')}
        </span>
        <span className="hidden sm:block h-5 w-[1px] bg-[#E2E8F0] dark:bg-white/10" aria-hidden="true" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t('trustBar.controlCost')}
        </span>
      </div>
    </>
  );
}
