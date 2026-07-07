"use client";

/**
 * TourOverlay — pure UI for the onboarding tour dialog.
 * Receives all state/handlers via props from OnboardingTourModal.
 */

import { useRef } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { STEPS, TOTAL_STEPS, StepConfig } from './tour-steps';

interface TourOverlayProps {
  step: number;
  completing: boolean;
  tier?: string;
  onSkip: () => void;
  onFinish: () => void;
  onNext: () => void;
  onBack: () => void;
  onActionNav: (href: string) => void;
  onFocusTrap: (e: React.KeyboardEvent, ref: React.RefObject<HTMLDivElement | null>) => void;
}

export function TourOverlay({
  step,
  completing,
  tier,
  onSkip,
  onFinish,
  onNext,
  onBack,
  onActionNav,
  onFocusTrap,
}: TourOverlayProps) {
  const t = useTranslations('onboarding');
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = 'onboarding-tour-title';

  const current: StepConfig = STEPS[step - 1];
  const isLast = step === TOTAL_STEPS;

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
        className="relative w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl rounded-2xl p-6"
        onKeyDown={(e) => onFocusTrap(e, dialogRef)}
      >
        {/* Skip button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 cursor-pointer p-1 rounded-md text-muted-foreground-500 hover:text-muted-foreground-900 dark:hover:text-muted-foreground-100 transition-colors duration-150"
          aria-label={t('skip')}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2 id={titleId} className="text-lg font-bold text-muted-foreground-900 dark:text-slate-100">{t('title')}</h2>
          <p className="text-sm text-muted-foreground-600 dark:text-slate-400 mt-1">{t('subtitle')}</p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-150 ${
                i + 1 === step ? 'w-6 bg-primary-600' : 'w-1.5 bg-muted-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[90px] mb-4">
          <p className="text-xs font-medium text-primary-600 dark:text-primary mb-2">
            {t('progress', { current: step, total: TOTAL_STEPS })}
          </p>
          <h3 className="text-base font-semibold text-muted-foreground-900 dark:text-slate-100 mb-2">
            {t(current.titleKey)}
          </h3>
          <p className="text-sm text-muted-foreground-600 dark:text-slate-400">
            {step === 1
              ? t('step1_desc', { tier: tier ?? 'BASIC' })
              : t(current.descKey)}
          </p>
        </div>

        {/* Action CTA */}
        {current.actionHref && current.actionKey && (
          <div className="mb-4">
            <button
              onClick={() => onActionNav(current.actionHref!)}
              disabled={completing}
              className="w-full cursor-pointer py-2 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-primary to-primary hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {t(current.actionKey)}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="cursor-pointer text-xs text-muted-foreground-500 hover:text-muted-foreground-700 dark:hover:text-muted-foreground-300 transition-colors duration-150"
          >
            {t('skip')}
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                className="cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                {t('back')}
              </Button>
            )}
            {!isLast ? (
              <Button
                size="sm"
                onClick={onNext}
                className="cursor-pointer flex items-center gap-1"
              >
                {t('next')}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onFinish}
                disabled={completing}
                className="cursor-pointer"
              >
                {t('finish')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
