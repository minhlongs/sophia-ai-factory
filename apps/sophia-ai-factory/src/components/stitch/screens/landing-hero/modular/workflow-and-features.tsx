// i18n-namespace: stitch.landing
import React from 'react';
import { Layers, Cpu, Video, Coins, Send, CheckCircle2 } from 'lucide-react';

interface WorkflowAndFeaturesProps {
  tLanding: (key: string) => string;
  t: (key: string) => string;
}

export function WorkflowAndFeatures({ tLanding, t }: WorkflowAndFeaturesProps) {
  const workflowSteps = [
    {
      step: '01',
      icon: Layers,
      title: tLanding('workflow.steps.select_niche.title'),
      desc: tLanding('workflow.steps.select_niche.description'),
    },
    {
      step: '02',
      icon: Cpu,
      title: tLanding('workflow.steps.ai_generate.title'),
      desc: tLanding('workflow.steps.ai_generate.description'),
    },
    {
      step: '03',
      icon: Video,
      title: tLanding('workflow.steps.publish.title'),
      desc: tLanding('workflow.steps.publish.description'),
    },
    {
      step: '04',
      icon: Coins,
      title: tLanding('workflow.steps.profit.title'),
      desc: tLanding('workflow.steps.profit.description'),
    },
  ];

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
    <>
      <section className="py-24 border-t border-white/[0.08] bg-[#0A0C14] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
              {tLanding('workflow.badge')}
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
              {tLanding('workflow.title')}
            </h3>
            <p className="text-slate-400 text-base">
              {tLanding('workflow.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflowSteps.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-[#11131E]/80 border border-white/[0.08] hover:border-indigo-500/40 hover:-translate-y-1 transition-all duration-300 shadow-xl group"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-2xl font-black font-mono text-slate-600 group-hover:text-indigo-400 transition-colors">
                      {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">{item.title}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-white/[0.08] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
              {tLanding('features.badge')}
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
              {tLanding('features.title')}
            </h3>
            <p className="text-slate-400 text-base">
              {tLanding('features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="p-8 rounded-2xl bg-[#11131E]/80 border border-white/[0.08] hover:border-indigo-500/40 hover:-translate-y-1 transition-all duration-300 shadow-xl group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform shadow-inner">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-slate-300">
                        {feat.badge}
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-white mb-3">{feat.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{feat.desc}</p>
                  </div>
                  <div className="mt-8 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{tLanding('features.production_ready')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
