/**
 * @module land/creative-mission/actions/track-status-helper
 * Track-level status resolution helper for creative missions.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import type { MissionTrackStatus } from '@/tree/mission';
import { getMissionTrackStatusSchema } from '../schemas';
import type { MissionError } from '../types';
import { actionFailure } from './action-helpers';

export interface MissionTrackStatusResponse {
  missionId: string;
  status: string;
  currentPhase: string;
  trackStatus: MissionTrackStatus;
}

/**
 * Resolves live track-level status for a creative mission (script, audio, visual, video).
 */
export async function queryMissionTrackStatus(
  input: string | { missionId: string },
): Promise<Result<MissionTrackStatusResponse, MissionError>> {
  try {
    const parsed = getMissionTrackStatusSchema.safeParse(input);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const missionId = typeof parsed.data === 'string' ? parsed.data : parsed.data.missionId;

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const mission = await d1
      .prepare('SELECT workspace_id, creator_id, status, current_phase, constraints FROM creative_missions WHERE id = ?')
      .bind(missionId)
      .first<{
        workspace_id: string;
        creator_id: string;
        status: string;
        current_phase: string;
        constraints: string | null;
      }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const { getMissionTrackStatus: getTreeTrackStatus } = await import('@/tree/mission');
    const trackStatus = await getTreeTrackStatus(missionId, mission.constraints);

    return success({
      missionId,
      status: mission.status,
      currentPhase: mission.current_phase,
      trackStatus,
    });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] getMissionTrackStatus', err));
  }
}
