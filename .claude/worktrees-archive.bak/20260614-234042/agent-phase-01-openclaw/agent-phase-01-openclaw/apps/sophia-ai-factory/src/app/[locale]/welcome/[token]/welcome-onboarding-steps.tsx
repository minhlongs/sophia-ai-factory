'use client';

/**
 * Welcome page onboarding steps configuration and step components.
 * Steps are PURELY informational — no CTAs (token not yet consumed at this stage).
 * Extracted from welcome-page-client for file size compliance.
 *
 * Localisation: all step labels go through next-intl welcome.steps.* keys.
 * `buildOnboardingSteps` returns translation keys + completion flags only — the
 * `StepCard` component is responsible for rendering localized copy.
 *
 * @module app/[locale]/welcome/[token]/welcome-onboarding-steps
 */

import { useTranslations } from 'next-intl';
import { CheckCircle2, Circle, Key, BarChart3, Settings, Zap } from 'lucide-react';

export interface WelcomeData {
  handoverId: string;
  agencyName: string;
  agencyType: string | null;
  tier: string;
  ownerEmail: string;
  ownerFullName: string;
  installedSops: string[];
  firstLoginAt: number | null;
  firstSopInstallAt: number | null;
  firstRunAt: number | null;
  status: string;
}

type StepKey =
  | 'accountCreated'
  | 'configureKeys'
  | 'verifyHeygen'
  | 'firstSop'
  | 'watchResults';

export interface OnboardingStep {
  id: number;
  /** i18n key under `welcome.steps.*` — drives title + description lookup. */
  key: StepKey;
  icon: React.ReactNode;
  /** Resolved at build time (depends on `WelcomeData`). */
  done: boolean;
  /** Optional interpolation params for the description string. */
  descParams?: { installedSopsCount: number };
}

export function buildOnboardingSteps(data: WelcomeData): OnboardingStep[] {
  return [
    {
      id: 1,
      key: 'accountCreated',
      icon: <CheckCircle2 aria-hidden="true" size={20} />,
      done: true,
    },
    {
      id: 2,
      key: 'configureKeys',
      icon: <Key aria-hidden="true" size={20} />,
      done: false,
    },
    {
      id: 3,
      key: 'verifyHeygen',
      icon: <Settings aria-hidden="true" size={20} />,
      done: false,
    },
    {
      id: 4,
      key: 'firstSop',
      icon: <Zap aria-hidden="true" size={20} />,
      done: !!data.firstRunAt,
      descParams: { installedSopsCount: data.installedSops.length },
    },
    {
      id: 5,
      key: 'watchResults',
      icon: <BarChart3 aria-hidden="true" size={20} />,
      done: !!(data.firstRunAt && data.firstSopInstallAt),
    },
  ];
}

interface StepCardProps { step: OnboardingStep }

export function StepCard({ step }: StepCardProps) {
  const t = useTranslations('welcome');

  // firstSop has a dynamic prefix derived from data.installedSops.length;
  // every other step renders a single static "description" key.
  const description = step.key === 'firstSop'
    ? (step.descParams && step.descParams.installedSopsCount > 0
        ? t('steps.firstSop.installedPrefix', { count: step.descParams.installedSopsCount })
        : '') + t('steps.firstSop.callToAction')
    : t(`steps.${step.key}.description`);

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${step.done ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-border/50 bg-muted/20 backdrop-blur-sm'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
          {step.done ? <CheckCircle2 aria-hidden="true" size={20} /> : <Circle aria-hidden="true" size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`font-semibold ${step.done ? 'text-emerald-300' : 'text-foreground'}`}>
              {t(`steps.${step.key}.title`)}
            </h3>
            <span className="text-xs text-muted-foreground shrink-0">{t('stepLabel')} {step.id}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}
