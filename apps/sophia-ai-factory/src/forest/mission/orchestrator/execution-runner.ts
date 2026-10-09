/**
 * End-to-End Multi-Track Mission Execution Runner.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/execution-runner
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  canStartExecution,
  clearTrackStatusCache,
  getMission,
  registerMultiTrackExecutor,
  EXECUTION_START_FROM,
  type MissionTrackStatus,
  type MultiTrackExecutionResult,
} from '@/tree/mission';
import { MissionError } from '@/tree/mission/types';
import { buildMultiTrackProviders } from '@/forest/ai/provider-factory';
import {
  saveCheckpoint,
  assertMissionActive,
  transitionStatusCAS,
} from './checkpoint-cas';
import { runScriptTrack } from './track-script';
import { runAudioAndVisualTracks } from './track-audio-visual-runner';
import { runVideoTrack } from './track-video';
import { handleExecutionFailure } from './execution-failure-handler';
import type { MultiTrackExecutionOptions } from './types';

export async function executeMultiTrackMission(
  missionId: string,
  options?: MultiTrackExecutionOptions,
): Promise<MultiTrackExecutionResult> {
  const mission = await getMission(missionId);
  if (!mission) {
    throw new MissionError('NOT_FOUND', `Mission ${missionId} not found`);
  }

  const workspaceId = options?.workspaceId || mission.workspaceId;
  const creatorId = options?.userId || mission.creatorId;

  if (mission.status !== 'running') {
    if (!canStartExecution(mission.status)) {
      throw new MissionError(
        'EXECUTION_START_INVALID',
        `Mission status '${mission.status}' cannot start execution. Valid states: ${EXECUTION_START_FROM.join(', ')}`
      );
    }
    await transitionStatusCAS(missionId, mission.status, 'running', 'executing');
  }

  const trackStatus: MissionTrackStatus = {
    script: 'pending',
    audio: 'pending',
    visual: 'pending',
    video: 'pending',
  };
  await saveCheckpoint(missionId, trackStatus, 'executing');
  if (options?.checkpointCallback) {
    await options.checkpointCallback(trackStatus, 'executing');
  }

  const resultTracks: MultiTrackExecutionResult['tracks'] = {};

  try {
    const videoChoice =
      options?.videoProviderChoice ||
      ((mission.constraints?.videoProvider as string) as 'kling' | 'hunyuan' | 'replicate') ||
      'kling';

    const providers =
      options?.providers ??
      (await buildMultiTrackProviders({
        userId: creatorId,
        tenantId: workspaceId,
        videoProviderChoice: videoChoice,
        imageProviderChoice: options?.imageProviderChoice,
      }));

    const topic = options?.topic || mission.title || 'Automated Creative Video';
    const targetScenes = options?.estimatedScenes || (mission.constraints?.estimatedScenes as number) || 3;
    const targetDuration = options?.durationSeconds || (mission.constraints?.durationSeconds as number) || 30;

    // Track 1: Script Synthesis
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

    // Mid-Flight Cancellation Check #1
    await assertMissionActive(missionId, options?.signal);

    // Parallel Track 2 (Audio) & Track 3 (Visual)
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
      rawRatio: options?.aspectRatio || (mission.constraints?.aspectRatio as string),
      voiceId: options?.voiceId,
      voiceStyle: options?.voiceStyle,
      trackStatus,
      signal: options?.signal,
    });

    resultTracks.audio = audioResult;
    resultTracks.visual = visualResult;

    // Mid-Flight Cancellation Check #2
    await assertMissionActive(missionId, options?.signal);

    // Track 4: Video Compositing
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

    // Final Atomic CAS Transition: running -> review
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

// Auto-register direct executor with Tree Service Bridge on module evaluation
registerMultiTrackExecutor(executeMultiTrackMission);
