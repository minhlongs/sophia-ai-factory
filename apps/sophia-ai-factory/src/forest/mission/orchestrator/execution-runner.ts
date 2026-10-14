/**
 * End-to-End Multi-Track Mission Execution Runner.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 * @module forest/mission/orchestrator/execution-runner
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  clearTrackStatusCache,
  registerMultiTrackExecutor,
  type MultiTrackExecutionResult,
} from '@/tree/mission';
import {
  saveCheckpoint,
  assertMissionActive,
  transitionStatusCAS,
} from './checkpoint-cas';
import { runScriptTrack } from './track-script';
import { runAudioAndVisualTracks } from './track-audio-visual-runner';
import { runVideoTrack } from './track-video';
import { handleExecutionFailure } from './execution-failure-handler';
import {
  prepareMissionExecution,
  resolveExecutionParameters,
} from './execution-runner-helpers';
import type { MultiTrackExecutionOptions } from './types';

export async function executeMultiTrackMission(
  missionId: string,
  options?: MultiTrackExecutionOptions,
): Promise<MultiTrackExecutionResult> {
  const { mission, workspaceId, creatorId, trackStatus } =
    await prepareMissionExecution(missionId, options);

  const resultTracks: MultiTrackExecutionResult['tracks'] = {};

  try {
    const { providers, topic, targetScenes, targetDuration, rawRatio } =
      await resolveExecutionParameters(mission, creatorId, workspaceId, options);

    const scriptResult = await runScriptTrack({
      providers,
      topic,
      objective: mission.objective,
      targetDuration,
      targetScenes,
      workspaceId,
      missionId,
      trackStatus,
      checkpointCallback: options?.checkpointCallback,
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
      providers,
      scenes: scriptResult.scenes,
      fullNarration: scriptResult.fullNarration,
      creatorId,
      workspaceId,
      missionId,
      targetDuration,
      rawRatio,
      voiceId: options?.voiceId,
      voiceStyle: options?.voiceStyle,
      trackStatus,
      signal: options?.signal,
    });

    resultTracks.audio = audioResult;
    resultTracks.visual = visualResult;

    await assertMissionActive(missionId, options?.signal);

    resultTracks.video = await runVideoTrack({
      providers,
      audioResult,
      visualResult,
      topic,
      creatorId,
      workspaceId,
      missionId,
      trackStatus,
      checkpointCallback: options?.checkpointCallback,
    });

    await saveCheckpoint(missionId, trackStatus, 'review', ['running', 'review']);
    await transitionStatusCAS(missionId, 'running', 'review', 'review');
    clearTrackStatusCache(missionId);

    if (options?.checkpointCallback) {
      await options.checkpointCallback(trackStatus, 'review');
    }

    logger.info('[MultiTrackOrchestrator] Multi-track mission successfully completed', {
      missionId,
      workspaceId,
      trackStatus,
    });

    return {
      success: true,
      missionId,
      workspaceId,
      status: 'review',
      currentPhase: 'review',
      trackStatus,
      tracks: resultTracks,
    };
  } catch (err) {
    return handleExecutionFailure({
      err,
      missionId,
      workspaceId,
      trackStatus,
      resultTracks,
      signal: options?.signal,
      checkpointCallback: options?.checkpointCallback,
    });
  }
}

registerMultiTrackExecutor(executeMultiTrackMission);
