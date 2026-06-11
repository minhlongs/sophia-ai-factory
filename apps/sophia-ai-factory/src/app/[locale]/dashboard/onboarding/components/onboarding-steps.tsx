/**
 * OnboardingSteps — client component rendering step cards for FREE100 onboarding.
 * Loads translations using useTranslations hook.
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Circle, Video, Share2, Wifi } from 'lucide-react';

export type OnboardingStepStatus = 'done' | 'current' | 'todo';

interface StepCardProps {
  status: OnboardingStepStatus;
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

interface OnboardingStepsProps {
  step1Done: boolean;
  step2Done: boolean;
  step3Done: boolean;
}

function StepIcon({ done, icon }: { done: boolean; icon: React.ReactNode }) {
  return done ? (
    <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" aria-hidden="true" />
  ) : (
    <span className="relative h-6 w-6 shrink-0">
      <Circle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
        {icon}
      </span>
    </span>
  );
}

function calcStatus(done: boolean, isNext: boolean): OnboardingStepStatus {
  if (done) return 'done';
  if (isNext) return 'current';
  return 'todo';
}

function StepCard({ status, icon, title, description, ctaLabel, ctaHref }: StepCardProps) {
  const borderClass =
    status === 'done'
      ? 'border-green-500/40 bg-green-500/5'
      : status === 'current'
        ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20'
        : 'border-border opacity-60';

  return (
    <div className={`rounded-lg border p-5 transition-all ${borderClass}`}>
      <div className="flex items-start gap-4">
        <StepIcon done={status === 'done'} icon={icon} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {status !== 'done' && (
            <Link
              href={ctaHref}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                ${status === 'current'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
            >
              {ctaLabel}
            </Link>
          )}
        </div>
        {status === 'done' && (
          <span className="text-xs text-green-600 font-medium shrink-0">Done</span>
        )}
      </div>
    </div>
  );
}

export function OnboardingSteps({ step1Done, step2Done, step3Done }: OnboardingStepsProps) {
  const t = useTranslations('dashboard.onboarding');
  const firstPending = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 0;

  const steps: StepCardProps[] = [
    {
      status: calcStatus(step1Done, firstPending === 1),
      icon: <Video className="h-3.5 w-3.5" />,
      title: t('step1_title'),
      description: t('step1_desc'),
      ctaLabel: t('step1_cta'),
      ctaHref: '/dashboard/videos/new',
    },
    {
      status: calcStatus(step2Done, firstPending === 2),
      icon: <Wifi className="h-3.5 w-3.5" />,
      title: t('step2_title'),
      description: t('step2_desc'),
      ctaLabel: t('step2_cta'),
      ctaHref: '/dashboard/integrations/channels',
    },
    {
      status: calcStatus(step3Done, firstPending === 3),
      icon: <Share2 className="h-3.5 w-3.5" />,
      title: t('step3_title'),
      description: t('step3_desc'),
      ctaLabel: t('step3_cta'),
      ctaHref: '/dashboard/videos/upload',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {steps.map((step, i) => (
        <StepCard key={i} {...step} />
      ))}
    </div>
  );
}
