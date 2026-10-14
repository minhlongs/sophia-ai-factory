/**
 * Pipeline Step Indicator Helpers & Color Styles
 *
 * Layer: forest/components/progress/steps
 */

import type { StepState } from './types';

export function resolveStepState(
  index: number,
  activeStep: number,
  status: 'active' | 'complete' | 'error',
): StepState {
  if (status === 'error' && index === activeStep) return 'error';
  if (index < activeStep) return 'complete';
  if (index === activeStep) return 'active';
  return 'pending';
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds == null || seconds <= 0) return '';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export const STATE_COLORS: Record<StepState, { bg: string; text: string; border: string }> = {
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
