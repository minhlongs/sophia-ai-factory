'use client';

/**
 * Autonomous Operations Cockpit - Telemetry Metric Cards
 *
 * @module land/autonomous/cockpit-metrics
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Bot, CheckCircle2, Cpu, TrendingUp } from 'lucide-react';
import type {
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousCycleRunRow,
} from '@/seed/types/autonomous-engine';

interface CockpitMetricsProps {
  state: AutonomousLoopStateRow;
  tasks: AutonomousScheduleTaskRow[];
  recentRuns: AutonomousCycleRunRow[];
}

export function CockpitMetrics({
  state,
  tasks,
  recentRuns,
}: CockpitMetricsProps) {
  const t = useTranslations('autonomous');

  const totalTasksExecuted = tasks.reduce((sum, task) => sum + (task.run_count || 0), 0);
  const totalAttempted = recentRuns.reduce((sum, run) => sum + (run.tasks_attempted || 0), 0);
  const totalSucceeded = recentRuns.reduce((sum, run) => sum + (run.tasks_succeeded || 0), 0);
  const successRatePct = totalAttempted > 0
    ? Math.round((totalSucceeded / totalAttempted) * 100)
    : state.consecutive_failures === 0 ? 100 : Math.max(0, 100 - state.consecutive_failures * 20);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Card 1: Active Skills */}
      <div className="p-5 bg-card border border-border rounded-xl space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-sm font-medium">{t('metrics.activeAgents')}</span>
          <Bot className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {tasks.filter((task) => task.enabled).length}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('status.cycleCount')}: {recentRuns.length}
        </p>
      </div>

      {/* Card 2: Tasks Executed */}
      <div className="p-5 bg-card border border-border rounded-xl space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-sm font-medium">{t('metrics.tasksExecuted')}</span>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {totalTasksExecuted}
        </div>
        <p className="text-xs text-muted-foreground">
          {recentRuns.length > 0
            ? `${recentRuns[0].tasks_succeeded} in latest cycle`
            : t('status.idle')}
        </p>
      </div>

      {/* Card 3: MCU Consumed */}
      <div className="p-5 bg-card border border-border rounded-xl space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-sm font-medium">{t('metrics.computeConsumed')}</span>
          <Cpu className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {Math.round(state.daily_mcu_consumed)}{' '}
          <span className="text-sm font-normal text-muted-foreground">MCU</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('metrics.costEstimate')}: ~${(state.daily_spend_cents / 100).toFixed(2)}
        </p>
      </div>

      {/* Card 4: Success Rate */}
      <div className="p-5 bg-card border border-border rounded-xl space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-sm font-medium">{t('metrics.successRate')}</span>
          <CheckCircle2 className="w-4 h-4 text-teal-500" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
          {successRatePct}%
        </div>
        <p className="text-xs text-muted-foreground">
          {t('status.consecutiveFailures')}: {state.consecutive_failures}
        </p>
      </div>

      {/* Card 5: Consciousness Score (0-100) */}
      <div className="p-5 bg-card border border-border rounded-xl space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-sm font-medium">{t('status.consciousness')}</span>
          <Activity className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
          {state.consciousness_score}/100
        </div>
        <p className="text-xs text-muted-foreground">
          {t('status.lastHeartbeat')}:{' '}
          {new Date(state.last_heartbeat_at * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
