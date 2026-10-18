'use client';

/**
 * CeoAgentOnboardingWrapper — first-time onboarding experience for PREMIUM+ users
 * on the /dashboard/agents/ page.
 *
 * Shows a welcome card ("Meet your AI Executive Board") and a 4-step tour overlay
 * (Chat, Briefing, Campaigns, Revenue). Both dismissible, stored in localStorage.
 *
 * Usage:
 *   <CeoAgentOnboardingWrapper />
 *   (renders nothing if dismissed or already completed)
 */

import { useState, useCallback, useEffect } from 'react';
import { CeoAgentTourOverlay } from './ceo-agent-tour-overlay';
import { CEO_AGENT_TOUR_STORAGE_KEY } from './ceo-agent-tour-config';
import { CeoAgentWelcomeCard } from './ceo-agent-welcome-card';

export function CeoAgentOnboardingWrapper() {
  // Dismissal state (welcome card)
  const [cardDismissed, setCardDismissed] = useState(true); // default hidden
  const [mounted, setMounted] = useState(false);

  // Tour overlay state
  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep, setTourStep] = useState(1);

  useEffect(() => {
    setMounted(true);
    const dismissed = localStorage.getItem(CEO_AGENT_TOUR_STORAGE_KEY);
    setCardDismissed(dismissed === '1');
    // Auto-show tour on first visit
    if (dismissed !== '1') {
      setTourVisible(true);
    }
  }, []);

  const dismissCard = useCallback(() => {
    setCardDismissed(true);
    localStorage.setItem(CEO_AGENT_TOUR_STORAGE_KEY, '1');
  }, []);

  const handleTourSkip = useCallback(() => {
    setTourVisible(false);
    dismissCard();
  }, [dismissCard]);

  const handleTourFinish = useCallback(() => {
    setTourVisible(false);
    dismissCard();
  }, [dismissCard]);

  const handleStartTour = useCallback(() => {
    setTourStep(1);
    setTourVisible(true);
  }, []);

  // Don't render anything until mounted (SSR safety)
  if (!mounted) return null;

  return (
    <>
      {!cardDismissed && (
        <CeoAgentWelcomeCard
          onDismiss={dismissCard}
          onStartTour={handleStartTour}
        />
      )}

      {tourVisible && (
        <CeoAgentTourOverlay
          step={tourStep}
          onSkip={handleTourSkip}
          onFinish={handleTourFinish}
          onNext={() => setTourStep((s) => s + 1)}
          onBack={() => setTourStep((s) => s - 1)}
        />
      )}
    </>
  );
}
