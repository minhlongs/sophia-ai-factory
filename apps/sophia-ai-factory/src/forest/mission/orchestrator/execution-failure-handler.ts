/**
 * Execution Failure & Cancellation Handler.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/execution-failure-handler
 */

import { logger } from '@/seed/utils/logger-utility';
import type { CreativeMissionStatus } from '@/seed/types/creative-economy';
import {
  clearTrackStatusCache,
  type MissionTrackStatus,
  type MultiTrackExecutionResult,
} from '@/tree/mission';
import { MissionError } from '@/tree/mission/types';
import { saveCheckpoint, transitionStatusCAS } from './checkpoint-cas';

export async function handleExecutionFailure(params: {
  err: unknown;
  missionId: string;
  workspaceId: string;
  trackStatus: MissionTrackStatus;
  resultTracks: MultiTrackExecutionResult['tracks'];
  signal?: AbortSignal;
  checkpointCallback?: (trackStatus: MissionTrackStatus, phase: string) => Promise<void> | void;
}): Promise<MultiTrackExecutionResult> {
  const {
    err,
    missionId,
    workspaceId,
    trackStatus,
    resultTracks,
    signal,
    checkpointCallback,
  } = params;

  const isCancelled =
    (err instanceof MissionError && err.code === 'MISSION_CANCELLED') ||
    Boolean(signal?.aborted) ||
    (err instanceof Error && err.message.toLowerCase().includes("'cancelled'"));

  const error =
    err instanceof MissionError
      ? `[${err.code}] ${err.message}`
      : err instanceof Error
      ? err.message
      : String(err);

  if (trackStatus.script === 'running') trackStatus.script = isCancelled ? 'cancelled' : 'failed';
  if (trackStatus.audio === 'running') trackStatus.audio = isCancelled ? 'cancelled' : 'failed';
  if (trackStatus.visual === 'running') trackStatus.visual = isCancelled ? 'cancelled' : 'failed';
  if (trackStatus.video === 'running') trackStatus.video = isCancelled ? 'cancelled' : 'failed';

  logger.error('[MultiTrackOrchestrator] Multi-track execution failed', {
    missionId,
    trackStatus,
    isCancelled,
    error,
  });

  const targetStatus: CreativeMissionStatus = isCancelled ? 'cancelled' : 'failed';
  const targetPhase = isCancelled ? 'cancelled' : 'failed';

  try {
    await transitionStatusCAS(missionId, 'running', targetStatus, targetPhase);
  } catch {
    // Ignore CAS error if already modified out-of-band
  }

  try {
    await saveCheckpoint(missionId, trackStatus, targetPhase, ['running', targetStatus]);
  } catch {
    // Non-fatal
  }
  clearTrackStatusCache(missionId);

  if (checkpointCallback) {
    try {
      await checkpointCallback(trackStatus, targetPhase);
    } catch {
      // non-fatal
    }
  }

  return {
    success: false,
    missionId,
    workspaceId,
    status: targetStatus,
    currentPhase: targetPhase,
    trackStatus,
    tracks: resultTracks,
    error,
  };
}
