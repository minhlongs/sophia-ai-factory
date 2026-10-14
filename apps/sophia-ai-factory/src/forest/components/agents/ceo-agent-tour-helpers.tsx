// i18n-namespace: dashboard.agents.onboarding_tour
'use client';

/**
 * Keyboard focus-trap helper and navigation footer for CeoAgentTourOverlay.
 * @module forest/components/agents/ceo-agent-tour-helpers
 */

import React from 'react';
import { ChevronRight, ChevronLeft, Bot, BrainCircuit, BarChart3, TrendingUp } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';

export const STEP_ICONS = [
  Bot,
  BrainCircuit,
  BarChart3,
  TrendingUp,
] as const;

export function handleTourDialogKeyDown(
  e: React.KeyboardEvent<HTMLDivElement>,
  dialog: HTMLDivElement | null,
  onSkip: () => void,
): void {
  if (e.key === 'Escape') {
    onSkip();
    return;
  }
  if (e.key !== 'Tab' || !dialog) return;
  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button, [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled'));
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function CeoAgentTourFooter({
  step,
  isLast,
  onSkip,
  onBack,
  onNext,
  onFinish,
  t,
}: {
  step: number;
  isLast: boolean;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <button
        onClick={onSkip}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {t('skip')}
      </button>
      <div className="flex gap-2">
        {step > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            {t('back')}
          </Button>
        )}
        {!isLast ? (
          <Button
            size="sm"
            onClick={onNext}
            className="flex items-center gap-1"
          >
            {t('next')}
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button size="sm" onClick={onFinish}>
            {t('finish')}
          </Button>
        )}
      </div>
    </div>
  );
}
