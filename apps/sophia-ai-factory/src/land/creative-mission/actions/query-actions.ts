/**
 * @module land/creative-mission/actions/query-actions
 * Query Server Actions for creative missions: list, get, and track status.
 *
 * Layer: land — imports seed and tree only.
 */

'use server';

import type { z } from 'zod';
import type { Result } from '@/seed/types/result';
import type {
  getMissionWithGoals as dbGetMissionWithGoals,
  MissionTrackStatus,
} from '@/tree/mission';
import type {
  listMissionsSchema,
  getMissionSchema,
} from '../schemas';
import type { MissionError } from '../types';
import { queryMissionTrackStatus } from './track-status-helper';
import { executeListMissions, executeGetMission } from './query-action-helpers';

/**
 * List all missions for a workspace.
 * Returns missions the user has access to.
 */
export async function listMissions(
  data: z.infer<typeof listMissionsSchema>
): Promise<Result<{ missions: Array<{ id: string; title: string; status: string }>; count: number }, MissionError>> {
  return executeListMissions(data);
}

/**
 * Get a single mission with its goals.
 * Returns the full mission object including all goals.
 */
export async function getMission(
  data: z.infer<typeof getMissionSchema>
): Promise<Result<{ mission: Awaited<ReturnType<typeof dbGetMissionWithGoals>> }, MissionError>> {
  return executeGetMission(data);
}

/**
 * Get live track-level status for a creative mission (script, audio, visual, video).
 */
export async function getMissionTrackStatus(
  input: string | { missionId: string }
): Promise<
  Result<
    {
      missionId: string;
      status: string;
      currentPhase: string;
      trackStatus: MissionTrackStatus;
    },
    MissionError
  >
> {
  return queryMissionTrackStatus(input);
}
