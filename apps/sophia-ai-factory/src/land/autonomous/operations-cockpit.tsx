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
import type {
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousDeadLetterRow,
  AutonomousCycleRunRow,
} from '@/seed/types/autonomous-engine';
import { useAutonomousCockpit } from './use-autonomous-cockpit';
import { CockpitHeaderBanner } from './cockpit-header-banner';
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

  return (
    <div className="space-y-6">
      {/* 1. Header & Status Alert Banner */}
      <CockpitHeaderBanner
        state={state.state}
        isPending={isPending}
        statusMessage={statusMessage}
        onDismissStatus={() => setStatusMessage(null)}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onForceCycle={handleForceCycle}
        onResetCircuit={handleResetCircuit}
        onEmergencyHalt={handleEmergencyHalt}
        onRefresh={refreshData}
      />

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
