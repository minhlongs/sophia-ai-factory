"use client";

/**
 * OnboardingTourModal — 5-step guided tour for first-time users.
 * Shown when users.onboarding_completed_at is null.
 * Persists dismissal to localStorage; calls API to mark complete on finish.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';

interface OnboardingTourModalProps {
  userId: string;
  onComplete?: () => void;
}

const STORAGE_KEY = 'sophia_tour_dismissed';
const TOTAL_STEPS = 5;

export function OnboardingTourModal({ userId, onComplete }: OnboardingTourModalProps) {
  const t = useTranslations('onboarding');
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [completing, setCompleting] = useState(false);
  const titleId = 'onboarding-tour-title';
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Save the element that opened the modal so focus can return on close
      triggerRef.current = document.activeElement as HTMLElement;
      setVisible(true);
    }
  }, []);

  // Escape key closes modal
  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleSkip();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Focus trap
  const handleFocusTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.hasAttribute('disabled'));
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
  }, []);

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    triggerRef.current?.focus();
  }

  async function handleFinish() {
    setCompleting(true);
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed: true, user_id: userId }),
      });
    } catch {
      // non-critical — local storage still prevents re-show
    }
    localStorage.setItem(STORAGE_KEY, '1');
    setCompleting(false);
    setVisible(false);
    triggerRef.current?.focus();
    onComplete?.();
  }

  if (!visible) return null;

  const steps = [
    { titleKey: 'step1_title' as const, descKey: 'step1_desc' as const },
    { titleKey: 'step2_title' as const, descKey: 'step2_desc' as const },
    { titleKey: 'step3_title' as const, descKey: 'step3_desc' as const },
    { titleKey: 'step4_title' as const, descKey: 'step4_desc' as const },
    { titleKey: 'step5_title' as const, descKey: 'step5_desc' as const },
  ];

  const current = steps[step - 1];

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
        onKeyDown={handleFocusTrap}
      >
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 cursor-pointer p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-150"
          aria-label={t('skip')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('title')}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t('subtitle')}</p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-150 ${
                i + 1 === step ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[100px] mb-6">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
            {t('progress', { current: step, total: TOTAL_STEPS })}
          </p>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {t(current.titleKey)}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t(current.descKey)}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors duration-150"
          >
            {t('skip')}
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(s => s - 1)}
                className="cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('back')}
              </Button>
            )}
            {step < TOTAL_STEPS ? (
              <Button
                size="sm"
                onClick={() => setStep(s => s + 1)}
                className="cursor-pointer flex items-center gap-1"
              >
                {t('next')}
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleFinish}
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
