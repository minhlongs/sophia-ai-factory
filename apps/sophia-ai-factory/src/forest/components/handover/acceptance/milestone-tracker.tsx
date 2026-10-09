/**
 * Acceptance Client Submodule: Milestone Tracker.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/milestone-tracker
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Check, Clock } from 'lucide-react';
import { Card } from '@/seed/components/ui/card';
import { cn } from '@/seed/utils/cn';

interface MilestoneTrackerProps {
  isAccepted: boolean;
}

export function MilestoneTracker({ isAccepted }: MilestoneTrackerProps) {
  const t = useTranslations('handover');

  return (
    <Card className="p-6 border-border/60 shadow-sm bg-card/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          {t('milestones.title')}
        </h2>
        <span className="text-xs font-medium text-muted-foreground">
          {isAccepted ? '4 of 4 Steps Complete (100%)' : '3 of 4 Steps Complete (75%)'}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted rounded-full h-2 mb-6 overflow-hidden">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: isAccepted ? '100%' : '75%' }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Milestone 1 */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="mt-0.5 w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{t('milestones.contract')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('milestones.completed')}</p>
          </div>
        </div>

        {/* Milestone 2 */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="mt-0.5 w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{t('milestones.initialSetup')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('milestones.completed')}</p>
          </div>
        </div>

        {/* Milestone 3 */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="mt-0.5 w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{t('milestones.verification')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">11/11 Probes Verified</p>
          </div>
        </div>

        {/* Milestone 4 */}
        <div
          className={cn(
            'flex items-start gap-3 p-3 rounded-lg border transition-all',
            isAccepted
              ? 'bg-emerald-500/5 border-emerald-500/30'
              : 'bg-primary/5 border-primary/30 ring-1 ring-primary/20',
          )}
        >
          <div
            className={cn(
              'mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0',
              isAccepted
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-primary/10 text-primary',
            )}
          >
            {isAccepted ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{t('milestones.acceptance')}</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              {isAccepted ? t('milestones.completed') : t('milestones.active')}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
