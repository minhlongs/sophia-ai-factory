'use client';

/**
 * Polling helper for First-Run Wizard mission status tracking.
 * @module components/missions/first-run/wizard-poll-helper
 */

// i18n-namespace: dashboard.missions.wizard

import type { MissionStageId } from '../mission-progress-bar';
import { getMissionTrackStatus } from '@/land/creative-mission/actions';
import {
  type WizardStatus,
  POLL_INTERVAL_MS,
  MAX_POLL_TIMEOUT_MS,
  STAGE_TO_KEY,
} from './types';
import { mapTrackStatusToStage } from './stage-resolver';

export interface PollWizardTrackParams {
  targetMissionId: string;
  isMounted: () => boolean;
  getPollStartedAt: () => number;
  t: (key: string, values?: Record<string, string | number>) => string;
  setStatus: (status: WizardStatus) => void;
  setCurrentStage: (stage: MissionStageId) => void;
  setErrorMessage: (message: string) => void;
  clearPolling: () => void;
  scheduleNextPoll: (delayMs: number) => void;
}

export async function pollWizardTrackStep(params: PollWizardTrackParams): Promise<void> {
  const {
    targetMissionId,
    isMounted,
    getPollStartedAt,
    t,
    setStatus,
    setCurrentStage,
    setErrorMessage,
    clearPolling,
    scheduleNextPoll,
  } = params;

  if (!isMounted()) return;
  if (Date.now() - getPollStartedAt() > MAX_POLL_TIMEOUT_MS) {
    setStatus('failed');
    setErrorMessage(t('timeoutError'));
    clearPolling();
    return;
  }

  try {
    const res = await getMissionTrackStatus(targetMissionId);
    if (!isMounted()) return;

    if (res.ok) {
      const { status: mStatus, currentPhase, trackStatus } = res.value;
      const mapped = mapTrackStatusToStage(mStatus, currentPhase, trackStatus);
      setCurrentStage(mapped.stage);

      if (mapped.uiStatus === 'completed') {
        setStatus('completed');
        clearPolling();
        return;
      }

      if (mapped.uiStatus === 'failed') {
        setStatus('failed');
        const stageKey = STAGE_TO_KEY[mapped.stage] || 'script_generation';
        setErrorMessage(t('stageFailureMessage', { stage: t(`stages.${stageKey}.label`) }));
        clearPolling();
        return;
      }
    }
    scheduleNextPoll(POLL_INTERVAL_MS);
  } catch {
    if (!isMounted()) return;
    scheduleNextPoll(POLL_INTERVAL_MS);
  }
}
