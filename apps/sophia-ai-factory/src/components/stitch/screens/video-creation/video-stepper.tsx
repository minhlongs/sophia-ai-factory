'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { STEPS } from './video-creation-types';

/**
 * Horizontal step progress indicator for the video creation wizard.
 */
export function VideoStepper({ currentStep }: { currentStep: number }) {
  const t = useTranslations('stitch.video-creation');

  return (
    <nav className="flex items-center gap-4 px-4 py-3 md:px-8" aria-label={t('stepProgress')}>
      {STEPS.map((step, idx) => {
        const isActive = step.id === currentStep;
        const isPast = step.id < currentStep;
        return (
          <React.Fragment key={step.id}>
            <div
              className={`flex items-center gap-2 ${!isActive && !isPast ? 'opacity-60' : ''}`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isPast
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${t('step')} ${step.id}`}
              >
                {step.id}
              </div>
              <span
                className={`hidden text-xs font-medium sm:block ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {t(`steps.${step.key}`)}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`hidden h-px flex-1 sm:block ${
                  isPast ? 'bg-primary' : 'bg-border'
                }`}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
