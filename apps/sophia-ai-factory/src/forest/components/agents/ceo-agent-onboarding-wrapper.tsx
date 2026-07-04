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
import { useTranslations } from 'next-intl';
import { X, Bot, BrainCircuit, BarChart3, TrendingUp, Play } from 'lucide-react';
import { Card, CardContent } from '@/seed/components/ui/card';
import { CeoAgentTourOverlay } from './ceo-agent-tour-overlay';
import { CEO_AGENT_TOUR_STORAGE_KEY } from './ceo-agent-tour-config';

// ── Welcome card step icons ─────────────────────────────────────────────────────

const WELCOME_STEPS = [
  { icon: Bot, key: 'chat' },
  { icon: BrainCircuit, key: 'briefing' },
  { icon: BarChart3, key: 'campaigns' },
  { icon: TrendingUp, key: 'revenue' },
] as const;

// ── Component ───────────────────────────────────────────────────────────────────

export function CeoAgentOnboardingWrapper() {
  const t = useTranslations('dashboard.agents.onboarding_tour');

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

  // ── Handlers ────────────────────────────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────────────────────

  // Don't render anything until mounted (SSR safety)
  if (!mounted) return null;

  return (
    <>
      {/* Welcome card */}
      {!cardDismissed && (
        <Card className="relative border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
          <button
            onClick={dismissCard}
            className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('dismiss')}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>

          <CardContent className="pt-6 pb-5">
            {/* Title */}
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-5 h-5 text-primary" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-foreground">
                {t('welcome_title')}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('welcome_desc')}
            </p>

            {/* Feature preview icons */}
            <div className="flex flex-wrap gap-4 mb-4">
              {WELCOME_STEPS.map((step) => (
                <div
                  key={step.key}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <step.icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t(`mini_${step.key}`)}</span>
                </div>
              ))}
            </div>

            {/* Start Tour button */}
            <button
              onClick={handleStartTour}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              {t('start_tour')}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Tour overlay */}
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
