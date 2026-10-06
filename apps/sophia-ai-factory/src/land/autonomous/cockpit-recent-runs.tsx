'use client';

/**
 * Autonomous Operations Cockpit - Recent Execution Cycles Panel
 *
 * @module land/autonomous/cockpit-recent-runs
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, TrendingUp } from 'lucide-react';
import type { AutonomousCycleRunRow } from '@/seed/types/autonomous-engine';

interface CockpitRecentRunsProps {
  recentRuns: AutonomousCycleRunRow[];
}

export function CockpitRecentRuns({ recentRuns }: CockpitRecentRunsProps) {
  const t = useTranslations('autonomous');

  return (
    <div className="p-6 bg-card border border-border rounded-xl space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        {t('runs.title')}
      </h2>

      <div className="space-y-3">
        {recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Chưa có chu kỳ thực thi nào / No execution cycles recorded.
          </p>
        ) : (
          recentRuns.slice(0, 5).map((run) => (
            <div
              key={run.id}
              className="p-3.5 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs"
            >
              <div className="space-y-1">
                <div className="font-mono font-medium text-foreground">{run.id}</div>
                <div className="text-muted-foreground flex items-center gap-1.5">
                  <span>{run.trigger_type}</span>
                  <span>•</span>
                  <span>
                    {run.state_before} <ArrowRight className="inline w-3 h-3" /> {run.state_after}
                  </span>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="font-semibold text-foreground">
                  {run.tasks_succeeded}/{run.tasks_attempted} {t('runs.tasksCount')}
                </div>
                <div className="text-muted-foreground font-mono">
                  {run.mcu_consumed} MCU • {run.duration_ms}ms
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
