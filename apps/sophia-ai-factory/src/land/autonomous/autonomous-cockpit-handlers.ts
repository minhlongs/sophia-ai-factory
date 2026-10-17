'use client';

/**
 * Autonomous Operations Cockpit - Action Dispatcher Helpers
 *
 * @module land/autonomous/autonomous-cockpit-handlers
 */

import type { TransitionStartFunction } from 'react';
import {
  startAutonomousLoopAction,
  pauseAutonomousLoopAction,
  resumeAutonomousLoopAction,
  emergencyHaltAutonomousLoopAction,
  resetCircuitBreakerAction,
  triggerAutonomousCycleAction,
  replayDeadLetterTaskAction,
} from './loop-actions';

export interface CockpitStatusMessage {
  type: 'success' | 'error';
  text: string;
}

export interface CockpitHandlerDeps {
  tenantId: string;
  t: (key: string) => string;
  startTransition: TransitionStartFunction;
  setStatusMessage: (msg: CockpitStatusMessage | null) => void;
  refreshData: () => Promise<void>;
}

export function createCockpitActionHandlers(deps: CockpitHandlerDeps) {
  const { tenantId, t, startTransition, setStatusMessage, refreshData } = deps;

  const runAction = (
    fn: () => Promise<{ success: boolean; error?: string }>,
    successMsgKey: string
  ) => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await fn();
      if (res.success) {
        setStatusMessage({ type: 'success', text: t(successMsgKey) });
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || t('messages.actionFailed') });
      }
    });
  };

  return {
    handleStart: () => runAction(() => startAutonomousLoopAction(tenantId), 'messages.started'),
    handlePause: () =>
      runAction(
        () => pauseAutonomousLoopAction('Manual pause from cockpit', tenantId),
        'messages.paused'
      ),
    handleResume: () => runAction(() => resumeAutonomousLoopAction(tenantId), 'messages.resumed'),
    handleForceCycle: () =>
      runAction(
        () => triggerAutonomousCycleAction({ force: true, tenantId }),
        'messages.cycleCompleted'
      ),
    handleEmergencyHalt: () => {
      if (!window.confirm(t('controls.confirmHalt'))) return;
      runAction(
        () => emergencyHaltAutonomousLoopAction('Emergency halt by operator', tenantId),
        'messages.halted'
      );
    },
    handleResetCircuit: () => {
      if (!window.confirm(t('controls.confirmReset'))) return;
      runAction(() => resetCircuitBreakerAction(tenantId), 'messages.circuitReset');
    },
    handleReplayDlq: (id: string) =>
      runAction(() => replayDeadLetterTaskAction(id, tenantId), 'messages.replayed'),
  };
}
