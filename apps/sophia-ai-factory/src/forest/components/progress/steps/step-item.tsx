'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/seed/components/ui/badge';
import { CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import type { Step, StepState } from './types';
import { STATE_COLORS } from './helpers';

export interface StepItemProps {
  step: Step;
  stepState: StepState;
}

export function StepItem({ step, stepState }: StepItemProps) {
  const t = useTranslations('streaming.steps');
  const colors = STATE_COLORS[stepState];
  const label = step.i18nKey
    ? t(step.i18nKey.replace('streaming.steps.', ''), { fallback: step.label })
    : step.label;

  return (
    <div
      role="listitem"
      aria-current={stepState === 'active' ? 'step' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all duration-300',
        colors.bg,
        colors.border,
        stepState === 'active' && 'shadow-sm',
      )}
    >
      {/* Icon */}
      <span className="shrink-0" aria-hidden="true">
        {stepState === 'complete' && (
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
        )}
        {stepState === 'active' && (
          <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 motion-safe:animate-spin" />
        )}
        {stepState === 'error' && (
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
        )}
        {stepState === 'pending' && (
          <Circle className="w-5 h-5 text-muted-foreground/50" />
        )}
      </span>

      {/* Label */}
      <span
        className={cn(
          'text-sm font-medium flex-1',
          stepState === 'pending' ? 'text-muted-foreground/70' : colors.text,
        )}
      >
        {label}
      </span>

      {/* Badge for step status */}
      {stepState === 'active' && (
        <Badge
          variant="outline"
          className="text-xs border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
        >
          {t('badge.active', { fallback: 'Running' })}
        </Badge>
      )}
      {stepState === 'complete' && (
        <Badge
          variant="outline"
          className="text-xs border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
        >
          {t('badge.complete', { fallback: 'Done' })}
        </Badge>
      )}
      {stepState === 'error' && (
        <Badge
          variant="outline"
          className="text-xs border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
        >
          {t('badge.error', { fallback: 'Failed' })}
        </Badge>
      )}

      {/* Screen-reader-only status text */}
      <span className="sr-only">
        {label}: {t(`status.${stepState}`, { fallback: stepState })}
      </span>
    </div>
  );
}
