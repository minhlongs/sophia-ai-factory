'use client';

/**
 * CeoAgentWelcomeCard — dismissible welcome banner for CEO Agent onboarding.
 *
 * Layer: forest/components/agents
 */

import { useTranslations } from 'next-intl';
import { X, Bot, BrainCircuit, BarChart3, TrendingUp, Play } from 'lucide-react';
import { Card, CardContent } from '@/seed/components/ui/card';

export const WELCOME_STEPS = [
  { icon: Bot, key: 'chat' },
  { icon: BrainCircuit, key: 'briefing' },
  { icon: BarChart3, key: 'campaigns' },
  { icon: TrendingUp, key: 'revenue' },
] as const;

export interface CeoAgentWelcomeCardProps {
  onDismiss: () => void;
  onStartTour: () => void;
}

export function CeoAgentWelcomeCard({
  onDismiss,
  onStartTour,
}: CeoAgentWelcomeCardProps) {
  const t = useTranslations('dashboard.agents.onboarding_tour');

  return (
    <Card className="relative border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t('dismiss')}
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>

      <CardContent className="pt-6 pb-5">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-foreground">
            {t('welcome_title')}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t('welcome_desc')}
        </p>

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

        <button
          onClick={onStartTour}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
        >
          <Play className="w-4 h-4" aria-hidden="true" />
          {t('start_tour')}
        </button>
      </CardContent>
    </Card>
  );
}
