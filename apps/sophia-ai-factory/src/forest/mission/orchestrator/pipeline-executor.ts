/**
 * Track pipeline execution helper for MultiTrackOrchestrator.
 * Layer: forest/mission/orchestrator
 * @module forest/mission/orchestrator/pipeline-executor
 */

import {
  saveCheckpoint,
  assertMissionActive,
  transitionStatusCAS,
} from './checkpoint-cas';
import { clearTrackStatusCache, type MultiTrackExecutionResult } from '@/tree/mission';
import { runScriptTrack } from './track-script';
import { runAudioAndVisualTracks } from './track-audio-visual-runner';
import { runVideoTrack } from './track-video';
import type { MultiTrackExecutionOptions, MissionTrackStatus } from './types';
import type { resolveExecutionParameters } from './execution-runner-helpers';

type ExecutionParameters = Awaited<ReturnType<typeof resolveExecutionParameters>>;

export async function runMultiTrackPipeline(params: {
  missionId: string;
  workspaceId: string;
  creatorId: string;
  missionObjective: string;
  params: ExecutionParameters;
  trackStatus: MissionTrackStatus;
  resultTracks: MultiTrackExecutionResult['tracks'];
  options?: MultiTrackExecutionOptions;
}): Promise<void> {
  const {
    missionId, workspaceId, creatorId, missionObjective, params: execParams,
    trackStatus, resultTracks, options,
  } = params;
  const { providers, topic, targetScenes, targetDuration, rawRatio } = execParams;

  const scriptResult = await runScriptTrack({
    providers, topic, objective: missionObjective, targetDuration, targetScenes,
    workspaceId, missionId, trackStatus, checkpointCallback: options?.checkpointCallback,
  });
  resultTracks.script = scriptResult;

  await assertMissionActive(missionId, options?.signal);

  trackStatus.audio = 'running';
  trackStatus.visual = 'running';
  await saveCheckpoint(missionId, trackStatus, 'voice_and_visuals');
  if (options?.checkpointCallback) {
    await options.checkpointCallback(trackStatus, 'voice_and_visuals');
  }

  const { audioResult, visualResult } = await runAudioAndVisualTracks({
    providers, scenes: scriptResult.scenes, fullNarration: scriptResult.fullNarration,
    creatorId, workspaceId, missionId, targetDuration, rawRatio,
    voiceId: options?.voiceId, voiceStyle: options?.voiceStyle, trackStatus, signal: options?.signal,
  });

  resultTracks.audio = audioResult;
  resultTracks.visual = visualResult;

  await assertMissionActive(missionId, options?.signal);

  resultTracks.video = await runVideoTrack({
    providers, audioResult, visualResult, topic,
    creatorId, workspaceId, missionId, trackStatus,
    checkpointCallback: options?.checkpointCallback,
  });

  await saveCheckpoint(missionId, trackStatus, 'review', ['running', 'review']);
  await transitionStatusCAS(missionId, 'running', 'review', 'review');
  clearTrackStatusCache(missionId);

  if (options?.checkpointCallback) {
    await options.checkpointCallback(trackStatus, 'review');
  }
}
