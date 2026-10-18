/**
 * @module land/creative-mission/actions/query-action-helpers
 * Internal query execution helpers for creative mission query actions.
 */

import type { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  verifyWorkspaceAccess,
  hasWorkspaceRole,
} from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { getMissionWithGoals as dbGetMissionWithGoals } from '@/tree/mission';
import {
  listMissionsSchema,
  getMissionSchema,
} from '../schemas';
import type { MissionError } from '../types';
import { actionFailure } from './action-helpers';

export async function executeListMissions(
  data: z.infer<typeof listMissionsSchema>
): Promise<Result<{ missions: Array<{ id: string; title: string; status: string }>; count: number }, MissionError>> {
  try {
    const parsed = listMissionsSchema.safeParse(data);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const result = await d1
      .prepare('SELECT id, title, status FROM creative_missions WHERE workspace_id = ? ORDER BY created_at DESC')
      .bind(parsed.data.workspaceId)
      .all<{ id: string; title: string; status: string }>();

    const missions = result.results ?? [];
    return success({ missions, count: missions.length });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] listMissions', err));
  }
}

export async function executeGetMission(
  data: z.infer<typeof getMissionSchema>
): Promise<Result<{ mission: Awaited<ReturnType<typeof dbGetMissionWithGoals>> }, MissionError>> {
  try {
    const parsed = getMissionSchema.safeParse(data);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const missionWithGoals = await dbGetMissionWithGoals(parsed.data.missionId);
    if (!missionWithGoals) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    const hasAccess = await verifyWorkspaceAccess(missionWithGoals.workspaceId, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    if (missionWithGoals.creatorId !== user.id) {
      const hasAdmin = await hasWorkspaceRole(missionWithGoals.workspaceId, user.id, 'ADMIN', d1);
      if (!hasAdmin) {
        return failure({ code: 'FORBIDDEN', message: 'You do not have permission to view this mission' });
      }
    }

    return success({ mission: missionWithGoals });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] getMission', err));
  }
}
