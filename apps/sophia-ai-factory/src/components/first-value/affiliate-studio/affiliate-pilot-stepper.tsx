'use client';

/**
 * 4-Step MMO Affiliate Progress Stepper for the Pilot Workspace.
 *
 * Gives non-technical MMO affiliates a clear linear path:
 * 1. Offer & Link -> 2. Script -> 3. Voice, MP4 & CapCut Pack -> 4. Publish & Track Clicks
 *
 * @module components/first-value/affiliate-studio/affiliate-pilot-stepper
 */

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface AffiliatePilotStepperProps {
  readonly hasOffer: boolean;
  readonly hasApprovedCampaign: boolean;
  readonly hasMp4OrLink: boolean;
  readonly hasManualPublish: boolean;
}

export function AffiliatePilotStepper(props: AffiliatePilotStepperProps) {
  const t = useTranslations('firstValue');

  const steps = [
    {
      num: 1,
      href: '#affiliate-offers',
      label: t('pilotStep1Offer'),
      done: props.hasOffer,
    },
    {
      num: 2,
      href: '#content-factory',
      label: t('pilotStep2Script'),
      done: props.hasApprovedCampaign,
    },
    {
      num: 3,
      href: '#pilot-mp4-affiliate',
      label: t('pilotStep3VideoPack'),
      done: props.hasMp4OrLink,
    },
    {
      num: 4,
      href: '#pilot-manual-publish',
      label: t('pilotStep4Publish'),
      done: props.hasManualPublish,
    },
  ] as const;

  const activeIndex = steps.findIndex((step) => !step.done);

  return (
    <nav
      aria-label="Pilot workflow progress"
      data-testid="pilot-workflow-stepper"
      className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-4"
    >
      {steps.map((step, index) => {
        const isCurrent = index === activeIndex;
        return (
          <a
            key={step.num}
            href={step.href}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              step.done
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : isCurrent
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current font-mono text-[10px]">
                {step.num}
              </span>
            )}
            <span className="truncate">{step.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
