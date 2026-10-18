// i18n-namespace: stitch.landing
import React from 'react';
import { Video, Send, Coins, CheckCircle2 } from 'lucide-react';

export interface LandingFeaturesSectionProps {
  tLanding: (key: string) => string;
  t: (key: string) => string;
}

export function LandingFeaturesSection({ tLanding, t }: LandingFeaturesSectionProps) {
  const features = [
    {
      icon: Video,
      title: t('features.scriptWriting.title'),
      desc: t('features.scriptWriting.description'),
      badge: 'AI Engine',
    },
    {
      icon: Send,
      title: t('features.multiChannel.title'),
      desc: t('features.multiChannel.description'),
      badge: 'Telegram Bot',
    },
    {
      icon: Coins,
      title: t('features.analytics.title'),
      desc: t('features.analytics.description'),
      badge: 'USDT Instant',
    },
  ];

  return (
    <section className="py-24 border-t border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10] relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#D97706] dark:text-[#F59E0B] mb-3">
            {tLanding('features.badge')}
          </h2>
          <h3 className="text-3xl sm:text-4xl font-black text-[#0B0F19] dark:text-white tracking-tight mb-4 font-display">
            {tLanding('features.title')}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 text-base">
            {tLanding('features.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="p-8 rounded-2xl bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] hover:border-[#4338CA]/40 dark:hover:border-[#6366F1]/40 hover:-translate-y-1 transition-all duration-300 shadow-sm dark:shadow-xl group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-[#4338CA]/10 dark:bg-[#6366F1]/10 flex items-center justify-center text-[#4338CA] dark:text-indigo-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.05] border border-[#E2E8F0] dark:border-white/[0.08] text-slate-700 dark:text-slate-300">
                      {feat.badge}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-[#0B0F19] dark:text-white mb-3">{feat.title}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{feat.desc}</p>
                </div>
                <div className="mt-8 pt-4 border-t border-[#E2E8F0] dark:border-white/[0.06] flex items-center gap-2 text-xs font-semibold text-[#4338CA] dark:text-indigo-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{tLanding('features.production_ready')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
