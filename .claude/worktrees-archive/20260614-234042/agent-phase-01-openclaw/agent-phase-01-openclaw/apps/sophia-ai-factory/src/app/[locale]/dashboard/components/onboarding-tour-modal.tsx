"use client";

/**
 * OnboardingTourModal — 7-step RaaS-focused guided tour for first-time users.
 * Shown on first visit (no onboarding_completed_at in DB) or via ?replayTour=1.
 * Persists completion to localStorage + API on finish/action-nav.
 *
 * Delegates state to useTour, UI to TourOverlay, step data to tour-steps.
 */

import { RotateCcw } from 'lucide-react';
import { useTour } from './onboarding-tour/use-tour';
import { TourOverlay } from './onboarding-tour/tour-overlay';

export interface OnboardingTourModalProps {
  userId: string;
  tier?: string;
  onComplete?: () => void;
}

export function OnboardingTourModal({ userId, tier, onComplete }: OnboardingTourModalProps) {
  const {
    visible,
    step,
    setStep,
    completing,
    handleSkip,
    handleFinish,
    handleActionNav,
    handleFocusTrap,
  } = useTour({ userId, onComplete });

  if (!visible) return null;

  return (
    <TourOverlay
      step={step}
      completing={completing}
      tier={tier}
      onSkip={handleSkip}
      onFinish={handleFinish}
      onNext={() => setStep(s => s + 1)}
      onBack={() => setStep(s => s - 1)}
      onActionNav={handleActionNav}
      onFocusTrap={handleFocusTrap}
    />
  );
}

// Re-export RotateCcw for sidebar convenience (tree-shaken if unused)
export { RotateCcw };
