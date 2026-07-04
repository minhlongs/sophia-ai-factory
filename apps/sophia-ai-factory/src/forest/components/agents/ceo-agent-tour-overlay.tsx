'use client';

/**
 * CeoAgentTourOverlay — modal dialog for the 4-step CEO Agent onboarding tour.
 *
 * Follows the same pattern as TourOverlay from the main dashboard, but
 * specialized for the agents page steps (Chat, Briefing, Campaigns, Revenue).
 * Uses its own storage key to avoid conflict with the main dashboard tour.
 */

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, ChevronRight, ChevronLeft, Bot, BrainCircuit, BarChart3, TrendingUp } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import {
  CEO_AGENT_TOUR_STEPS,
  CEO_AGENT_TOTAL_STEPS,
} from './ceo-agent-tour-config';

// ── Step icons ──────────────────────────────────────────────────────────────────

const STEP_ICONS = [
  Bot,
  BrainCircuit,
  BarChart3,
  TrendingUp,
] as const;

// ── Props ───────────────────────────────────────────────────────────────────────

interface CeoAgentTourOverlayProps {
  step: number;
  onSkip: () => void;
  onFinish: () => void;
  onNext: () => void;
  onBack: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────────

export function CeoAgentTourOverlay({
  step,
  onSkip,
  onFinish,
  onNext,
  onBack,
}: CeoAgentTourOverlayProps) {
  const t = useTranslations('dashboard.agents.onboarding_tour');
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = 'ceo-agent-tour-title';

  const current = CEO_AGENT_TOUR_STEPS[step - 1];
  const isLast = step === CEO_AGENT_TOTAL_STEPS;
  const StepIcon = STEP_ICONS[step - 1];

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      onSkip();
      return;
    }
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md bg-card border border-border shadow-xl rounded-2xl p-6"
        onKeyDown={handleKeyDown}
      >
        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('skip')}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <StepIcon className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id={titleId} className="text-lg font-bold text-foreground">
              {t('title')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-5">
          {CEO_AGENT_TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i + 1 === step
                  ? 'w-6 bg-primary'
                  : 'w-1.5 bg-muted-foreground/20'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[100px] mb-4">
          <p className="text-xs font-medium text-primary mb-2">
            {t('progress', {
              current: step,
              total: CEO_AGENT_TOTAL_STEPS,
            })}
          </p>
          <h3 className="text-base font-semibold text-foreground mb-2">
            {t(current.titleKey)}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t(current.descKey)}
          </p>
        </div>

        {/* Navigation */}
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
      </div>
    </div>
  );
}
