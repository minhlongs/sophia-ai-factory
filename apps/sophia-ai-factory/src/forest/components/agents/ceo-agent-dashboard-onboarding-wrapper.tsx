'use client';

/**
 * CeoAgentDashboardOnboardingWrapper — first-use experience for PREMIUM+ users
 * on `/dashboard/ceo-agent`.
 *
 * On first visit (no localStorage dismissal), a welcome card and a 4-step tour
 * overlay introduce Briefing, Campaigns, Revenue, and Chat.
 *
 * Both are dismissible; state is stored under the dashboard-specific key so the
 * existing agents-page tour continues to work independently.
 *
 * Usage:
 * ```tsx
 * <CeoAgentDashboardOnboardingWrapper />
 * ```
 * Renders nothing if dismissed or already completed.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, BookOpen, Newspaper, Megaphone, TrendingUp, Play } from 'lucide-react';
import { Card, CardContent } from '@/seed/components/ui/card';
import {
  CeoAgentDashboardTourOverlay,
} from './ceo-agent-dashboard-tour-overlay';
import {
  CEO_DASHBOARD_TOUR_STORAGE_KEY,
  CEO_DASHBOARD_TOUR_TOTAL_STEPS,
} from './ceo-agent-dashboard-tour-config';

// ── Welcome card feature icons ─────────────────────────────────────────────────

const WELCOME_STEPS = [
  { icon: BookOpen, key: 'briefing' },
  { icon: Megaphone, key: 'campaigns' },
  { icon: TrendingUp, key: 'revenue' },
  { icon: Newspaper, key: 'chat' },
] as const;

// ── Component ───────────────────────────────────────────────────────────────────

export function CeoAgentDashboardOnboardingWrapper() {
  const t = useTranslations('dashboard.ceoAgent.onboarding_tour');

  // Dismissal state (welcome card)
  const [cardDismissed, setCardDismissed] = useState(true); // default hidden
  const [mounted, setMounted] = useState(false);

  // Tour overlay state
  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep, setTourStep] = useState(1);

  useEffect(() => {
    setMounted(true);
    const dismissed = localStorage.getItem(CEO_DASHBOARD_TOUR_STORAGE_KEY);
    setCardDismissed(dismissed === '1');
    // Auto-show tour on first visit
    if (dismissed !== '1') {
      setTourVisible(true);
    }
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const dismissCard = useCallback(() => {
    setCardDismissed(true);
    localStorage.setItem(CEO_DASHBOARD_TOUR_STORAGE_KEY, '1');
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
              <Play className="w-5 h-5 text-primary" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-foreground">
                {t('dashboard_welcome_title')}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('dashboard_welcome_desc')}
            </p>

            {/* Feature preview icons */}
            <div className="flex flex-wrap gap-4 mb-4">
              {WELCOME_STEPS.map((step) => (
                <div
                  key={step.key}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <step.icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t(`dashboard_mini_${step.key}`)}</span>
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
        <CeoAgentDashboardTourOverlay
          step={tourStep}
          onSkip={handleTourSkip}
          onFinish={handleTourFinish}
          onNext={() => setTourStep((s) => s + 1)}
          onBack={() => setTourStep((s) => Math.max(1, s - 1))}
        />
      )}
    </>
  );
}
