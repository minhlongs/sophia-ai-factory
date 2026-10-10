'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/tree/components/setup-wizard/wizard-stepper';
import { CheckCircle } from 'lucide-react';
import type { TemplateStep } from './types';

interface StepIndicatorProps {
  currentStep: TemplateStep;
}

const STEPS: TemplateStep[] = ['select', 'edit', 'confirm'];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const t = useTranslations('setupWizard.whatsappTemplates');

  return (
    <div className="flex items-center justify-center gap-4 mb-8">
      {STEPS.map((s, i) => {
        const isPast = ['edit', 'confirm'].indexOf(currentStep) > ['select', 'edit', 'confirm'].indexOf(s);
        const isCurrent = currentStep === s;

        return (
          <React.Fragment key={s}>
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                isCurrent
                  ? 'bg-primary border-primary text-primary-foreground'
                  : isPast
                  ? 'bg-muted border-muted text-muted-foreground'
                  : 'bg-background border-primary text-primary'
              )}
            >
              {isPast ? (
                <CheckCircle className="w-5 h-5" aria-hidden="true" />
              ) : (
                <span className="font-semibold">{i + 1}</span>
              )}
            </div>
            <span
              className={cn(
                'hidden sm:block text-sm font-medium',
                isCurrent ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {t(`steps.${s}`) || s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 2 && (
              <div
                className={cn(
                  'hidden md:block w-20 h-1 rounded-full',
                  ['edit', 'confirm'].indexOf(currentStep) > i ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
