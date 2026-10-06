'use client';

/**
 * Autonomous Operations Cockpit - State & Action Hook
 *
 * @module land/autonomous/use-autonomous-cockpit
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type {
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousDeadLetterRow,
  AutonomousCycleRunRow,
} from '@/seed/types/autonomous-engine';
import {
  startAutonomousLoopAction,
  pauseAutonomousLoopAction,
  resumeAutonomousLoopAction,
  emergencyHaltAutonomousLoopAction,
  resetCircuitBreakerAction,
  triggerAutonomousCycleAction,
  replayDeadLetterTaskAction,
  getAutonomousLoopStatusAction,
} from './loop-actions';

export interface UseAutonomousCockpitProps {
  initialState: AutonomousLoopStateRow;
  initialTasks: AutonomousScheduleTaskRow[];
  initialRecentRuns: AutonomousCycleRunRow[];
  initialDlqTasks: AutonomousDeadLetterRow[];
  tenantId?: string;
}

export function useAutonomousCockpit({
  initialState,
  initialTasks,
  initialRecentRuns,
  initialDlqTasks,
  tenantId = 'default',
}: UseAutonomousCockpitProps) {
  const t = useTranslations('autonomous');
  const [isPending, startTransition] = useTransition();

  const [state, setState] = useState<AutonomousLoopStateRow>(initialState);
  const [tasks, setTasks] = useState<AutonomousScheduleTaskRow[]>(initialTasks);
  const [recentRuns, setRecentRuns] = useState<AutonomousCycleRunRow[]>(initialRecentRuns);
  const [dlqTasks, setDlqTasks] = useState<AutonomousDeadLetterRow[]>(initialDlqTasks);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const refreshData = async () => {
    startTransition(async () => {
      const res = await getAutonomousLoopStatusAction(tenantId);
      if (res.success && res.data) {
        setState(res.data.loopState);
        setTasks(res.data.tasks);
        setRecentRuns(res.data.recentRuns);
        setDlqTasks(res.data.deadLetterTasks);
      }
    });
  };

  const handleStart = () => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await startAutonomousLoopAction(tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.started') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handlePause = () => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await pauseAutonomousLoopAction('Manual pause from cockpit', tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.paused') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handleResume = () => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await resumeAutonomousLoopAction(tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.resumed') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handleForceCycle = () => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await triggerAutonomousCycleAction({ force: true, tenantId });
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.cycleCompleted') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handleEmergencyHalt = () => {
    if (!window.confirm(t('controls.confirmHalt'))) return;
    startTransition(async () => {
      setStatusMessage(null);
      const res = await emergencyHaltAutonomousLoopAction('Emergency halt by operator', tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.halted') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handleResetCircuit = () => {
    if (!window.confirm(t('controls.confirmReset'))) return;
    startTransition(async () => {
      setStatusMessage(null);
      const res = await resetCircuitBreakerAction(tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.circuitReset') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  const handleReplayDlq = (id: string) => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await replayDeadLetterTaskAction(id, tenantId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: t('messages.replayed') });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  return {
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
  };
}
