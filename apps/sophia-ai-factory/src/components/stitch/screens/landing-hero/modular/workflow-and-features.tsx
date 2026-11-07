// i18n-namespace: stitch.landing
import React from 'react';
import { Layers, Cpu, Video, Coins } from 'lucide-react';
import {
  LandingFeaturesSection,
  type LandingFeaturesSectionProps,
} from './landing-features-section';
import { OpcArchitectureBanner } from './opc-architecture-banner';
import { SophiaAgentChatReplay } from './sophia-agent-chat-replay';

export { LandingFeaturesSection, type LandingFeaturesSectionProps };

export interface WorkflowAndFeaturesProps {
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

  const painPoints = [
    {
      num: '01',
      title: t('v3Core.pain1Title'),
      desc: t('v3Core.pain1Desc'),
    },
    {
      num: '02',
      title: t('v3Core.pain2Title'),
      desc: t('v3Core.pain2Desc'),
    },
    {
      num: '03',
      title: t('v3Core.pain3Title'),
      desc: t('v3Core.pain3Desc'),
    },
  ];

  return (
    <>
      {/* ════ CHAPTER 01: #why — Outlined Stroke Pain Numbers & Pivot Turn ════ */}
      <section
        id="why"
        className="chapter border-t border-[#E2E8F0] dark:border-white/[0.08] bg-slate-100/60 dark:bg-[#0E1017]"
      >
        <div className="panel">
          <p className="kicker">{t('v3Core.whyKicker')}</p>
          <h2 className="h2">{t('v3Core.whyTitle')}</h2>

          <ol className="pains">
            {painPoints.map((pain) => (
              <li key={pain.num}>
                <span className="num">{pain.num}</span>
                <div>
                  <strong>{pain.title}</strong>
                  <p>{pain.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="turn">{t('v3Core.whyTurn')}</p>
        </div>
      </section>

      {/* ════ CHAPTER 02: #how — Live Command & Chat Replay + 4-Step Pipeline ═ */}
      <section
        id="how"
        className="chapter border-t border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10]"
      >
        <div className="panel">
          <p className="kicker">{t('v3Core.howKicker')}</p>
          <h2 className="h2">{t('v3Core.howTitle')}</h2>
          <p className="lead">{tLanding('workflow.subtitle')}</p>

          <div className="mb-10">
            <SophiaAgentChatReplay />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflowSteps.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] hover:border-[#4338CA]/40 dark:hover:border-[#6366F1]/40 hover:-translate-y-1 transition-all duration-300 shadow-sm dark:shadow-xl group"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 group-hover:text-[#4338CA] dark:group-hover:text-indigo-400 transition-colors">
                      STEP {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-[#4338CA]/10 dark:bg-[#6366F1]/10 flex items-center justify-center text-[#4338CA] dark:text-indigo-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-[#0B0F19] dark:text-white mb-2">
                    {item.title}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>

          <OpcArchitectureBanner />
        </div>
      </section>

      {/* ════ CHAPTER 03: #ecosystem — Feature Bento & RaaS Command Matrix ════ */}
      <div id="ecosystem">
        <LandingFeaturesSection tLanding={tLanding} t={t} />
      </div>
    </>
  );
}
