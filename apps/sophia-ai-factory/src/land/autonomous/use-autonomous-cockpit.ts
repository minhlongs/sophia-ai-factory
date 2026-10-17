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
import { getAutonomousLoopStatusAction } from './loop-actions';
import {
  createCockpitActionHandlers,
  type CockpitStatusMessage,
} from './autonomous-cockpit-handlers';

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
  const [statusMessage, setStatusMessage] = useState<CockpitStatusMessage | null>(null);

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

  const handlers = createCockpitActionHandlers({
    tenantId,
    t,
    startTransition,
    setStatusMessage,
    refreshData,
  });

  return {
    state,
    tasks,
    recentRuns,
    dlqTasks,
    statusMessage,
    setStatusMessage,
    isPending,
    refreshData,
    ...handlers,
  };
}
