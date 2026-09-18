'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { MarketingNav, MarketingFooter } from '@/components/stitch/layouts';
import {
  Brain,
  Video,
  Coins,
  Globe,
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
} from 'lucide-react';

const FEATURE_ICONS: Record<string, React.ElementType> = {
  ai_engine: Brain,
  video_factory: Video,
  credits: Coins,
  api: Globe,
};

const FEATURE_KEYS = [
  'ai_engine',
  'video_factory',
  'credits',
  'api',
] as const;

export default function FeaturesPage() {
  const t = useTranslations('landing.features');

  return (
    <div className="min-h-screen bg-[#08090D] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      <MarketingNav />

      <main className="relative pt-36 pb-24 overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />

        {/* Hero */}
        <section className="py-12 px-6 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            {t('badge_label')}
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 font-display">
            {t('title')}
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </section>

        {/* Feature Grid */}
        <section className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {FEATURE_KEYS.map((key) => {
              const Icon = FEATURE_ICONS[key] ?? Brain;
              return (
                <div
                  key={key}
                  className="group relative rounded-2xl border border-white/[0.08] bg-[#11131E]/80 p-8 hover:border-indigo-500/40 hover:-translate-y-1 transition-all duration-300 shadow-xl backdrop-blur-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="p-3.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform shadow-inner">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-indigo-300">
                        {t(`items.${key}.badge`)}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">
                      {t(`items.${key}.title`)}
                    </h3>
                    <p className="text-slate-300 text-base leading-relaxed">
                      {t(`items.${key}.description`)}
                    </p>
                  </div>
                  <div className="mt-8 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <Zap className="w-3.5 h-3.5" />
                      Zero-Mock Production
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                      BYOK
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Highlight Card */}
          <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-indigo-950/40 border border-indigo-500/30 backdrop-blur-xl text-center">
            <p className="text-slate-200 text-base leading-relaxed max-w-3xl mx-auto">
              {t('highlight')}
            </p>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-20 px-6 text-center max-w-3xl mx-auto border-t border-white/[0.08]">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Bắt đầu xây dựng đế chế video AI của bạn ngay hôm nay
          </h2>
          <p className="text-slate-400 text-sm mb-8">
            Start building your AI video empire today. Setup takes less than 2 minutes.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold px-8 py-4 rounded-xl hover:from-indigo-500 hover:to-violet-500 transition-all shadow-xl shadow-indigo-500/30 border border-indigo-400/30 active:scale-[0.98]"
          >
            <span>Bắt Đầu Ngay / Get Started</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
