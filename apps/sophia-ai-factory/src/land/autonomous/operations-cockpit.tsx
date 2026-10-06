'use client';

/**
 * Autonomous Operations Cockpit Component
 *
 * Layer: land/autonomous (Interactive Client Component)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 * Bilingual: VI / EN via next-intl ('autonomous' namespace)
 *
 * @module land/autonomous/operations-cockpit
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import type {
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousDeadLetterRow,
  AutonomousCycleRunRow,
} from '@/seed/types/autonomous-engine';
import { useAutonomousCockpit } from './use-autonomous-cockpit';
import { CockpitStateBadge } from './cockpit-state-badge';
import { CockpitControls } from './cockpit-controls';
import { CockpitMetrics } from './cockpit-metrics';
import { CockpitTasksTable } from './cockpit-tasks-table';
import { CockpitRecentRuns } from './cockpit-recent-runs';
import { CockpitDlqPanel } from './cockpit-dlq-panel';

export interface OperationsCockpitProps {
  initialState: AutonomousLoopStateRow;
  initialTasks: AutonomousScheduleTaskRow[];
  initialRecentRuns: AutonomousCycleRunRow[];
  initialDlqTasks: AutonomousDeadLetterRow[];
  tenantId?: string;
}

export function OperationsCockpit({
  initialState,
  initialTasks,
  initialRecentRuns,
  initialDlqTasks,
  tenantId = 'default',
}: OperationsCockpitProps) {
  const t = useTranslations('autonomous');
  const {
    state,
    tasks,
    recentRuns,
    dlqTasks,
    statusMessage,
    setStatusMessage,
    isPending,
    refreshData,
    handleStart,
    handlePause,
    handleResume,
    handleForceCycle,
    handleEmergencyHalt,
    handleResetCircuit,
    handleReplayDlq,
  } = useAutonomousCockpit({
    initialState,
    initialTasks,
    initialRecentRuns,
    initialDlqTasks,
    tenantId,
  });

  const getStateLabel = (st: string) => {
    switch (st) {
      case 'RUNNING':
        return t('status.running');
      case 'PAUSED':
        return t('status.paused');
      case 'RECOVERING':
        return t('status.recovering');
      case 'CIRCUIT_BROKEN':
        return t('status.circuitBroken');
      case 'IDLE':
      default:
        return t('status.idle');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-card border border-border rounded-xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
            <CockpitStateBadge
              state={state.state}
              label={getStateLabel(state.state)}
            />
          </div>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <CockpitControls
          state={state.state}
          isPending={isPending}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onForceCycle={handleForceCycle}
          onResetCircuit={handleResetCircuit}
          onEmergencyHalt={handleEmergencyHalt}
          onRefresh={refreshData}
        />
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold uppercase hover:underline"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Key Telemetry Metric Cards */}
      <CockpitMetrics state={state} tasks={tasks} recentRuns={recentRuns} />

      {/* 3. Automated Workflows & Skills Table */}
      <CockpitTasksTable tasks={tasks} />

      {/* 4. Recent Execution Cycles & DLQ Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CockpitRecentRuns recentRuns={recentRuns} />
        <CockpitDlqPanel
          dlqTasks={dlqTasks}
          isPending={isPending}
          onReplayDlq={handleReplayDlq}
        />
      </div>
    </div>
  );
}
