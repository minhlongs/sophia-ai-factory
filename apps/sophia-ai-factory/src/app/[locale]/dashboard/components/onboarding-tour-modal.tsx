"use client";

/**
 * OnboardingTourModal — 7-step RaaS-focused guided tour for first-time users.
 * Shown on first visit (no onboarding_completed_at in DB) or via ?replayTour=1.
 * Persists completion to localStorage + API on finish/action-nav.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, RotateCcw } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/seed/components/ui/button';

interface StepConfig {
  titleKey: string;
  descKey: string;
  actionKey?: string;
  actionHref?: string;
}

interface OnboardingTourModalProps {
  userId: string;
  tier?: string;
  onComplete?: () => void;
}

const STORAGE_KEY = 'sophia_tour_dismissed';
const TOTAL_STEPS = 7;

const STEPS: StepConfig[] = [
  { titleKey: 'step1_title', descKey: 'step1_desc' },
  { titleKey: 'step2_title', descKey: 'step2_desc', actionKey: 'step2_action', actionHref: '/dashboard/byok' },
  { titleKey: 'step3_title', descKey: 'step3_desc', actionKey: 'step3_action', actionHref: '/dashboard/sop-marketplace' },
  { titleKey: 'step4_title', descKey: 'step4_desc', actionKey: 'step4_action', actionHref: '/dashboard/sops' },
  { titleKey: 'step5_title', descKey: 'step5_desc', actionKey: 'step5_action', actionHref: '/dashboard/analytics' },
  { titleKey: 'step6_title', descKey: 'step6_desc', actionKey: 'step6_action', actionHref: '/dashboard/credits' },
  { titleKey: 'step7_title', descKey: 'step7_desc', actionKey: 'step7_action', actionHref: '/dashboard/support' },
];

export function OnboardingTourModal({ userId, tier, onComplete }: OnboardingTourModalProps) {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const locale = useLocale();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [completing, setCompleting] = useState(false);
  const titleId = 'onboarding-tour-title';
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    const replay = new URLSearchParams(window.location.search).get('replayTour') === '1';
    if (!dismissed || replay) {
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
      // non-critical — localStorage still prevents re-show
    }
    localStorage.setItem(STORAGE_KEY, '1');
    setCompleting(false);
    setVisible(false);
    triggerRef.current?.focus();
    onComplete?.();
  }

  async function handleActionNav(href: string) {
    // Mark complete first, then SPA-navigate via router so locale prefix is preserved.
    await handleFinish();
    const localized = locale && locale !== 'en' && href.startsWith('/') ? `/${locale}${href}` : href;
    router.push(localized);
  }

  if (!visible) return null;

  const current = STEPS[step - 1];
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
        <div className="mb-5">
          <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('title')}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t('subtitle')}</p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-150 ${
                i + 1 === step ? 'w-6 bg-violet-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[90px] mb-4">
          <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-2">
            {t('progress', { current: step, total: TOTAL_STEPS })}
          </p>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {t(current.titleKey)}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {step === 1
              ? t('step1_desc', { tier: tier ?? 'BASIC' })
              : t(current.descKey)}
          </p>
        </div>

        {/* Action CTA — shown when step has an actionHref */}
        {current.actionHref && current.actionKey && (
          <div className="mb-4">
            <button
              onClick={() => handleActionNav(current.actionHref!)}
              disabled={completing}
              className="w-full cursor-pointer py-2 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {t(current.actionKey)}
            </button>
          </div>
        )}

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
            {!isLast ? (
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

// Re-export RotateCcw for sidebar convenience (tree-shaken if unused)
export { RotateCcw };
