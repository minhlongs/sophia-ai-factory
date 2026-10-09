/**
 * Parallel Audio & Visual Execution Coordinator.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/track-audio-visual-runner
 */

import {
  type MissionTrackStatus,
  type MultiTrackAudioResult,
  type MultiTrackVisualResult,
  type ScriptScene,
} from '@/tree/mission';
import { MissionError } from '@/tree/mission/types';
import type { MultiTrackProviders } from '@/forest/ai/provider-factory';
import { runAudioTrack } from './track-audio';
import { runVisualTrack } from './track-visual';

export async function runAudioAndVisualTracks(params: {
  providers: MultiTrackProviders;
  scenes: ScriptScene[];
  fullNarration: string;
  creatorId: string;
  workspaceId: string;
  missionId: string;
  targetDuration: number;
  rawRatio?: string;
  voiceId?: string;
  voiceStyle?: string;
  trackStatus: MissionTrackStatus;
  signal?: AbortSignal;
}): Promise<{
  audioResult: MultiTrackAudioResult;
  visualResult: MultiTrackVisualResult;
}> {
  const {
    providers,
    scenes,
    fullNarration,
    creatorId,
    workspaceId,
    missionId,
    targetDuration,
    rawRatio,
    voiceId,
    voiceStyle,
    trackStatus,
    signal,
  } = params;

  const abortController = new AbortController();
  const { signal: parallelSignal } = abortController;
  if (signal?.aborted) {
    abortController.abort(signal.reason);
  } else if (signal) {
    signal.addEventListener('abort', () => abortController.abort(signal?.reason), { once: true });
  }

  const [audioSettled, visualSettled] = await Promise.allSettled([
    runAudioTrack({
      providers,
      fullNarration,
      creatorId,
      workspaceId,
      missionId,
      targetDuration,
      voiceId,
      voiceStyle,
      trackStatus,
      parallelSignal,
      abortController,
    }),
    runVisualTrack({
      providers,
      scenes,
      workspaceId,
      missionId,
      rawRatio,
      trackStatus,
      parallelSignal,
      abortController,
    }),
  ]);

  if (audioSettled.status === 'rejected' || visualSettled.status === 'rejected') {
    const isAbortErr = (r: unknown) =>
      (r instanceof MissionError && r.code === 'ABORTED') ||
      (r instanceof Error && r.message.toLowerCase().includes('cancelled'));

    let rootErr: unknown;
    if (audioSettled.status === 'rejected' && visualSettled.status === 'rejected') {
      rootErr = !isAbortErr(audioSettled.reason) ? audioSettled.reason : visualSettled.reason;
    } else if (audioSettled.status === 'rejected') {
      rootErr = audioSettled.reason;
    } else {
      rootErr = (visualSettled as PromiseRejectedResult).reason;
    }

    if (audioSettled.status === 'rejected' && trackStatus.audio === 'running') {
      trackStatus.audio = isAbortErr(audioSettled.reason) ? 'cancelled' : 'failed';
    }
    if (visualSettled.status === 'rejected' && trackStatus.visual === 'running') {
      trackStatus.visual = isAbortErr(visualSettled.reason) ? 'cancelled' : 'failed';
    }
    throw rootErr;
  }

  return {
    audioResult: (audioSettled as PromiseFulfilledResult<MultiTrackAudioResult>).value,
    visualResult: (visualSettled as PromiseFulfilledResult<MultiTrackVisualResult>).value,
  };
}
