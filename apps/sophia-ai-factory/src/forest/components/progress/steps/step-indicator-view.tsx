'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/seed/components/ui/card';
import { cn } from '@/seed/utils/cn';
import type { StepIndicatorProps } from './types';
import { resolveStepState } from './helpers';
import { ProgressHeader } from './progress-header';
import { StepItem } from './step-item';

export function StepIndicator({
  steps,
  activeStep,
  status,
  statusMessage,
  progress = 0,
  estimatedRemainingSec,
  className,
}: StepIndicatorProps) {
  const t = useTranslations('streaming.steps');

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="pt-6">
        <ProgressHeader
          status={status}
          statusMessage={statusMessage}
          progress={progress}
          estimatedRemainingSec={estimatedRemainingSec}
        />

        {/* Step list */}
        <div
          role="list"
          aria-label={t('aria.label', { fallback: 'Pipeline steps' })}
          className="space-y-0"
        >
          {steps.map((step, index) => {
            const stepState = resolveStepState(index, activeStep, status);
            return <StepItem key={step.id} step={step} stepState={stepState} />;
          })}
        </div>
      </CardContent>
    </Card>
  );
}

StepIndicator.displayName = 'StepIndicator';
