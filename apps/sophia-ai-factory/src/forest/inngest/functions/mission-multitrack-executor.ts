/**
 * Inngest Multi-Track Mission Execution Function
 * Layer: forest
 *
 * Listens for creative.mission.multitrack.requested events and delegates
 * execution to the multi-track orchestrator.
 *
 * @module forest/inngest/functions/mission-multitrack-executor
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { executeMultiTrackMission } from '@/forest/mission/multi-track-orchestrator';

export const missionMultiTrackExecutor = inngest.createFunction(
  { id: 'mission-multitrack-executor', retries: 1 },
  { event: 'creative.mission.multitrack.requested' },
  async ({ event }) => {
    const {
      missionId,
      userId,
      workspaceId,
      topic,
      estimatedScenes,
      durationSeconds,
      aspectRatio,
    } = event.data;

    logger.info('[missionMultiTrackExecutor] executing multi-track mission', {
      missionId,
      userId,
      workspaceId,
    });

    return await executeMultiTrackMission(missionId, {
      userId,
      workspaceId,
      topic,
      estimatedScenes,
      durationSeconds,
      aspectRatio,
    });
  },
);
