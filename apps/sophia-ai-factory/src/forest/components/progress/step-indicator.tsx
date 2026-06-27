'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/seed/components/ui/badge';
import { Progress } from '@/seed/components/ui/progress';
import { Card, CardContent } from '@/seed/components/ui/card';
import { CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('forest/components/progress/step-indicator');

/** A single pipeline step definition. */
export interface Step {
  /** Stable identifier for the step (e.g. "script", "tts"). */
  id: string;
  /** Display label — used as fallback when no i18n key is provided. */
  label: string;
  /** Optional i18n key under `streaming.steps.<id>` for bilingual labels. */
  i18nKey?: string;
  /** Estimated seconds this step typically takes. Used to show time remaining. */
  estimatedDurationSec?: number;
}

export interface StepIndicatorProps {
  /** Ordered pipeline steps. */
  steps: Step[];
  /** Zero-based index of the currently active step. -1 means none active. */
  activeStep: number;
  /** Overall pipeline status. */
  status: 'active' | 'complete' | 'error';
  /** Optional human-readable status message from the stream. */
  statusMessage?: string;
  /** Progress percentage (0-100) for the overall pipeline or current step. */
  progress?: number;
  /** Estimated seconds remaining for the current step, if known. */
  estimatedRemainingSec?: number;
  /** Additional CSS class name. */
  className?: string;
}

type StepState = 'pending' | 'active' | 'complete' | 'error';

function resolveStepState(
  index: number,
  activeStep: number,
  status: 'active' | 'complete' | 'error',
): StepState {
  if (status === 'error' && index === activeStep) return 'error';
  if (index < activeStep) return 'complete';
  if (index === activeStep) return 'active';
  return 'pending';
}

function formatDuration(seconds: number | undefined): string {
  if (seconds == null || seconds <= 0) return '';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

const STATE_COLORS: Record<StepState, { bg: string; text: string; border: string }> = {
  pending: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
  active: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
  },
  complete: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-300 dark:border-green-700',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
  },
};

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
  const tCommon = useTranslations('common');
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const activeState = activeStep >= 0 && activeStep < steps.length
    ? resolveStepState(activeStep, activeStep, status)
    : 'pending';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="pt-6">
        {/* Overall progress bar */}
        {(status === 'active' || status === 'error') && (
          <div className="mb-5">
            <Progress
              value={clampedProgress}
              className="h-2"
              aria-label={`${tCommon('progress', { fallback: 'Progress' })}: ${clampedProgress}%`}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-muted-foreground">
                {statusMessage || t('status.active', { fallback: 'In progress...' })}
              </span>
              {estimatedRemainingSec != null && estimatedRemainingSec > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t('eta', { fallback: '~{time} remaining' })}
                  {' '}
                  {formatDuration(estimatedRemainingSec)}
                </span>
              )}
            </div>
          </div>
        )}

        {status === 'complete' && (
          <div className="mb-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>{t('status.complete', { fallback: 'Complete' })}</span>
          </div>
        )}

        {status === 'error' && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            <span>
              {statusMessage || t('status.error', { fallback: 'Error occurred' })}
            </span>
          </div>
        )}

        {/* Step list */}
        <div
          role="list"
          aria-label={t('aria.label', { fallback: 'Pipeline steps' })}
          className="space-y-0"
        >
          {steps.map((step, index) => {
            const stepState = resolveStepState(index, activeStep, status);
            const colors = STATE_COLORS[stepState];
            const label = step.i18nKey
              ? t(step.i18nKey.replace('streaming.steps.', ''), { fallback: step.label })
              : step.label;

            return (
              <div
                key={step.id}
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

                {/* Badge for active step */}
                {stepState === 'active' && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300',
                    )}
                  >
                    {t('badge.active', { fallback: 'Running' })}
                  </Badge>
                )}
                {stepState === 'complete' && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs border-green-300 dark:border-green-700 text-green-700 dark:text-green-300',
                    )}
                  >
                    {t('badge.complete', { fallback: 'Done' })}
                  </Badge>
                )}
                {stepState === 'error' && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs border-red-300 dark:border-red-700 text-red-700 dark:text-red-300',
                    )}
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
          })}
        </div>
      </CardContent>
    </Card>
  );
}

StepIndicator.displayName = 'StepIndicator';
