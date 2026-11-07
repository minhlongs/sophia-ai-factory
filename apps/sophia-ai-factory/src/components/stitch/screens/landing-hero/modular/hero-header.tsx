// i18n-namespace: stitch.landing
import React from 'react';
import { ArrowRight, Play, ShieldCheck } from 'lucide-react';
import { Link } from '@/navigation';

export interface HeroHeaderProps {
  t: (key: string) => string;
}

export function HeroHeader({ t }: HeroHeaderProps) {
  return (
    <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
      {/* .v3-core Telemetry Eyebrow with Pulsing Dot */}
      <p className="eyebrow">
        <span className="dot" aria-hidden="true" />
        <span>{t('v3Core.eyebrow')}</span>
        <span className="hidden sm:inline opacity-75">• {t('badge')}</span>
      </p>

      {/* .v3-core Two-Tier Variable Display Headline (Archivo wdth 104) */}
      <h1 className="h1 max-w-5xl mx-auto">
        <span className="h1-a">{t('v3Core.headlineLead')}</span>
        <span className="h1-b">{t('headline')}</span>
      </h1>

      {/* Subheading */}
      <p className="lead mx-auto mb-8">{t('subheading')}</p>

      {/* .v3-core Pill CTAs with Diagonal Shimmer Sweep */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto mb-8">
        <Link href="/register" className="btn btn-lg btn-primary w-full sm:w-auto">
          <span>{t('cta.startFree')}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/guide" className="btn btn-lg btn-ghost w-full sm:w-auto">
          <Play className="w-4 h-4 text-amber-500" />
          <span>{t('cta.watchDemo')}</span>
        </Link>
      </div>

      {/* Plain-language control note: content, keys, spend cap, money */}
      <div className="max-w-3xl rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white/80 dark:bg-[#11131F]/80 px-4 py-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-4">
        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#4338CA] dark:text-indigo-300 mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>{t('trustBar.label')}</span>
        </div>
        <p className="leading-relaxed">{t('controlNote')}</p>
      </div>

      {/* Factual governance pills — no fake user counts or ratings */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400 mb-6 font-mono">
        <span className="px-3 py-1 rounded-full border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F]">
          {t('trustBar.controlContent')}
        </span>
        <span className="px-3 py-1 rounded-full border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F]">
          {t('trustBar.controlCost')}
        </span>
        <span className="px-3 py-1 rounded-full border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F]">
          {t('trustBar.videos')}
        </span>
      </div>

      <p className="mb-8 text-xs font-mono text-slate-500 dark:text-slate-400">
        {t('demoNote')}
      </p>
    </div>
  );
}
