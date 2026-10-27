// i18n-namespace: stitch.landing
import React from 'react';
import { Link } from '@/navigation';
import { ArrowRight, Play, Star } from 'lucide-react';
import { LANDING_HERO_AVATARS } from './types';

interface HeroHeaderProps {
  t: (key: string) => string;
}

export function HeroHeader({ t }: HeroHeaderProps) {
  return (
    <>
      {/* Ambient Multi-Layer Studio Lighting */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] pointer-events-none -z-10"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#4338CA]/10 via-[#D97706]/5 to-transparent dark:from-[#6366F1]/18 dark:via-[#F59E0B]/8 dark:to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[300px] bg-[#D97706]/10 dark:bg-[#F59E0B]/10 blur-[120px] rounded-full" />
      </div>

      {/* Director's Control Deck Status & Announcement Badge */}
      <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] mb-8 shadow-sm hover:border-[#4338CA]/40 dark:hover:border-[#6366F1]/40 transition-colors">
        <span className="camera-rec">REC</span>
        <span className="h-3.5 w-[1px] bg-[#E2E8F0] dark:bg-white/10" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wider text-[#4338CA] dark:text-indigo-300">
          {t('badge')}
        </span>
      </div>

      {/* Primary Headline */}
      <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-[1.08] tracking-tight max-w-5xl mb-6 text-[#0B0F19] dark:text-white font-display">
        {t('headline')}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4338CA] via-indigo-500 to-[#D97706] dark:from-indigo-400 dark:via-indigo-300 dark:to-[#F59E0B]">
          {t('headlineHighlight')}
        </span>
      </h1>

      {/* Subheading */}
      <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mb-10 leading-relaxed font-normal">
        {t('subheading')}
      </p>

      {/* Action CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-16 w-full sm:w-auto">
        <Link
          href="/register"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-white bg-[#4338CA] hover:bg-indigo-600 dark:bg-[#6366F1] dark:hover:bg-indigo-500 shadow-lg shadow-[#4338CA]/20 dark:shadow-indigo-500/25 border border-indigo-400/20 transition-all active:scale-[0.98] group"
        >
          <span>{t('cta.startFree')}</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/features"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-[#0B0F19] dark:text-slate-200 bg-white hover:bg-slate-50 dark:bg-[#11131F] dark:hover:bg-white/[0.08] border border-[#E2E8F0] dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 shadow-sm transition-all"
        >
          <Play className="w-4 h-4 text-[#D97706] fill-[#D97706] dark:text-[#F59E0B] dark:fill-[#F59E0B]" />
          <span>{t('cta.watchDemo')}</span>
        </Link>
      </div>

      {/* Social Proof Bar */}
      <div className="studio-glass flex flex-wrap items-center justify-center gap-6 py-3.5 px-6 rounded-2xl bg-white/90 dark:bg-[#11131F]/90 border border-[#E2E8F0] dark:border-white/[0.08] mb-20 shadow-lg dark:shadow-2xl">
        <div className="flex -space-x-2.5 items-center">
          {LANDING_HERO_AVATARS.map((src, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full border-2 border-white dark:border-[#11131F] overflow-hidden bg-slate-200 dark:bg-slate-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-cover"
                src={src}
                alt={`Creator ${i + 1}`}
              />
            </div>
          ))}
          <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#11131F] flex items-center justify-center bg-[#4338CA] dark:bg-[#6366F1] text-white text-[10px] font-bold font-mono">
            BYOK
          </div>
        </div>

        <div className="hidden sm:block h-5 w-[1px] bg-[#E2E8F0] dark:bg-white/10" />

        <div className="flex items-center gap-1.5">
          <div className="flex text-[#D97706] dark:text-[#F59E0B]">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-current" />
            ))}
          </div>
          <span className="text-xs font-bold font-mono text-[#0B0F19] dark:text-white">L1–L7</span>
        </div>

        <div className="hidden sm:block h-5 w-[1px] bg-[#E2E8F0] dark:bg-white/10" />

        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="text-[#0B0F19] dark:text-white font-bold">{t('trustBar.creators')}</span> · {t('trustBar.videos')}
        </p>
      </div>
    </>
  );
}
