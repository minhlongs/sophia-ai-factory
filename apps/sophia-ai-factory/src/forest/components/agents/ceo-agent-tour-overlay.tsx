'use client';

/**
 * CeoAgentTourOverlay — modal dialog for the 4-step CEO Agent onboarding tour.
 */

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import {
  CEO_AGENT_TOUR_STEPS,
  CEO_AGENT_TOTAL_STEPS,
} from './ceo-agent-tour-config';
import {
  STEP_ICONS,
  handleTourDialogKeyDown,
  CeoAgentTourFooter,
} from './ceo-agent-tour-helpers';

interface CeoAgentTourOverlayProps {
  step: number;
  onSkip: () => void;
  onFinish: () => void;
  onNext: () => void;
  onBack: () => void;
}

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
        onKeyDown={(e) => handleTourDialogKeyDown(e, dialogRef.current, onSkip)}
      >
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('skip')}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

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

        <CeoAgentTourFooter
          step={step}
          isLast={isLast}
          onSkip={onSkip}
          onBack={onBack}
          onNext={onNext}
          onFinish={onFinish}
          t={(k) => t(k)}
        />
      </div>
    </div>
  );
}
