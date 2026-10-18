/**
 * End-to-End Multi-Track Mission Execution Runner.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 * @module forest/mission/orchestrator/execution-runner
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  registerMultiTrackExecutor,
  type MultiTrackExecutionResult,
} from '@/tree/mission';
import { handleExecutionFailure } from './execution-failure-handler';
import {
  prepareMissionExecution,
  resolveExecutionParameters,
} from './execution-runner-helpers';
import { runMultiTrackPipeline } from './pipeline-executor';
import type { MultiTrackExecutionOptions } from './types';

export async function executeMultiTrackMission(
  missionId: string,
  options?: MultiTrackExecutionOptions,
): Promise<MultiTrackExecutionResult> {
  const { mission, workspaceId, creatorId, trackStatus } =
    await prepareMissionExecution(missionId, options);

  const resultTracks: MultiTrackExecutionResult['tracks'] = {};

  try {
    const execParams = await resolveExecutionParameters(mission, creatorId, workspaceId, options);

    await runMultiTrackPipeline({
      missionId,
      workspaceId,
      creatorId,
      missionObjective: mission.objective,
      params: execParams,
      trackStatus,
      resultTracks,
      options,
    });

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
