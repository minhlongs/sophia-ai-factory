/**
 * Context & Provider Resolution Helpers for Multi-Track Mission Execution.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 * @module forest/mission/orchestrator/execution-runner-helpers
 */

import {
  canStartExecution,
  getMission,
  EXECUTION_START_FROM,
  type MissionTrackStatus,
} from '@/tree/mission';
import { MissionError } from '@/tree/mission/types';
import { buildMultiTrackProviders } from '@/forest/ai/provider-factory';
import { saveCheckpoint, transitionStatusCAS } from './checkpoint-cas';
import type { MultiTrackExecutionOptions } from './types';

export async function prepareMissionExecution(
  missionId: string,
  options?: MultiTrackExecutionOptions,
) {
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
        `Mission status '${mission.status}' cannot start execution. Valid states: ${EXECUTION_START_FROM.join(', ')}`,
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

  return { mission, workspaceId, creatorId, trackStatus };
}

export async function resolveExecutionParameters(
  mission: NonNullable<Awaited<ReturnType<typeof getMission>>>,
  creatorId: string,
  workspaceId: string,
  options?: MultiTrackExecutionOptions,
) {
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
  const targetScenes =
    options?.estimatedScenes || (mission.constraints?.estimatedScenes as number) || 3;
  const targetDuration =
    options?.durationSeconds || (mission.constraints?.durationSeconds as number) || 30;
  const rawRatio = options?.aspectRatio || (mission.constraints?.aspectRatio as string);

  return { providers, topic, targetScenes, targetDuration, rawRatio };
}
