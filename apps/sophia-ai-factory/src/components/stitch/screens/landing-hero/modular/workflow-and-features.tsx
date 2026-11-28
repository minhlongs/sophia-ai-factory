// i18n-namespace: stitch.landing
import React from 'react';
import {
  Layers,
  Cpu,
  Video,
  Coins,
  Clock,
  ShieldAlert,
  BotOff,
  Sparkles,
} from 'lucide-react';
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
      icon: Clock,
      title: t('v3Core.pain1Title'),
      desc: t('v3Core.pain1Desc'),
    },
    {
      num: '02',
      icon: ShieldAlert,
      title: t('v3Core.pain2Title'),
      desc: t('v3Core.pain2Desc'),
    },
    {
      num: '03',
      icon: BotOff,
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
            {painPoints.map((pain) => {
              const PainIcon = pain.icon;
              return (
                <li key={pain.num} className="md3-surface-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary-container)] text-primary-text">
                      <PainIcon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="num">{pain.num}</span>
                  </div>
                  <div>
                    <strong>{pain.title}</strong>
                    <p>{pain.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="turn">
            <span className="inline-flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>{t('v3Core.whyTurn')}</span>
            </span>
          </p>
        </div>
      </section>

      {/* ════ CHAPTER 02: #how — Live Command & Chat Replay + 4-Step Pipeline ═ */}
      <section
        id="how"
        className="chapter border-t border-border bg-background"
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
                  className="md3-surface-card p-6 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="font-code text-xs font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground group-hover:text-primary-text transition-colors">
                      STEP {item.step}
                    </span>
                    <div className="h-11 w-11 rounded-2xl bg-[var(--md-sys-color-primary-container)] flex items-center justify-center text-primary-text group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-2">
                    {item.title}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
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
