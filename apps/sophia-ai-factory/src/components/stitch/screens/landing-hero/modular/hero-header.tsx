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
      {/* Ambient Multi-Layer Radial Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] pointer-events-none -z-10"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-600/20 via-purple-600/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[300px] bg-amber-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Pulsing Announcement Badge */}
      <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 mb-8 shadow-inner hover:border-indigo-500/40 transition-colors">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
          {t('badge')}
        </span>
      </div>

      {/* Primary Headline */}
      <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-[1.08] tracking-tight max-w-5xl mb-6 text-white font-display">
        {t('headline')}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-amber-300">
          {t('headlineHighlight')}
        </span>
      </h1>

      {/* Subheading */}
      <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mb-10 leading-relaxed font-normal">
        {t('subheading')}
      </p>

      {/* Action CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-16 w-full sm:w-auto">
        <Link
          href="/register"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/45 border border-indigo-400/30 transition-all active:scale-[0.98] group"
        >
          <span>{t('cta.startFree')}</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/features"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-slate-200 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 transition-all backdrop-blur-md"
        >
          <Play className="w-4 h-4 text-indigo-400 fill-indigo-400" />
          <span>{t('cta.watchDemo')}</span>
        </Link>
      </div>

      {/* Social Proof Bar */}
      <div className="flex flex-wrap items-center justify-center gap-6 py-3.5 px-6 rounded-2xl bg-[#11131E]/80 border border-white/[0.08] backdrop-blur-xl mb-20 shadow-2xl">
        <div className="flex -space-x-2.5 items-center">
          {LANDING_HERO_AVATARS.map((src, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full border-2 border-[#11131E] overflow-hidden bg-slate-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-cover"
                src={src}
                alt={`Creator ${i + 1}`}
              />
            </div>
          ))}
          <div className="w-8 h-8 rounded-full border-2 border-[#11131E] flex items-center justify-center bg-indigo-600 text-white text-[11px] font-bold">
            +10k
          </div>
        </div>

        <div className="hidden sm:block h-5 w-[1px] bg-white/10" />

        <div className="flex items-center gap-1.5">
          <div className="flex text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
            ))}
          </div>
          <span className="text-xs font-bold text-white">4.9/5</span>
        </div>

        <div className="hidden sm:block h-5 w-[1px] bg-white/10" />

        <p className="text-xs font-semibold text-slate-300">
          <span className="text-white font-bold">{t('trustBar.creators')}</span> · {t('trustBar.videos')}
        </p>
      </div>
    </>
  );
}
