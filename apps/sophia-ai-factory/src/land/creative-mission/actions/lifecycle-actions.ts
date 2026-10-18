/**
 * @module land/creative-mission/actions/lifecycle-actions
 * Lifecycle Server Actions for creative missions: create and update status.
 *
 * Layer: land — imports seed and tree only.
 */

'use server';

import type { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { updateMissionStatus as treeUpdateMissionStatus } from '@/tree/mission';
import { createMissionSchema, updateMissionStatusSchema } from '../schemas';
import type { MissionAction, MissionError } from '../types';
import { actionFailure } from './action-helpers';
import {
  authorizeMissionStatusUpdate,
  createMissionAndEmitTelemetry,
  revalidateMissionStatusPaths,
} from './lifecycle-action-helpers';

/**
 * Create a new creative mission.
 * Requires authenticated user with access to the specified workspace.
 */
export async function createMission(
  data: z.infer<typeof createMissionSchema>
): Promise<Result<MissionAction, MissionError>> {
  try {
    const parsed = createMissionSchema.safeParse(data);
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

    const mission = await createMissionAndEmitTelemetry(parsed.data, user.id);
    return success({ missionId: mission.id });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] createMission', err));
  }
}

/**
 * Update mission status with transition validation.
 * Validates the transition is allowed before updating.
 */
export async function updateMissionStatus(
  data: z.infer<typeof updateMissionStatusSchema>
): Promise<Result<MissionAction, MissionError>> {
  try {
    const parsed = updateMissionStatusSchema.safeParse(data);
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

    const authResult = await authorizeMissionStatusUpdate(d1, parsed.data.missionId, user.id);
    if (!authResult.ok) return authResult;

    const updated = await treeUpdateMissionStatus(
      parsed.data.missionId,
      parsed.data.status,
      authResult.value.currentPhase
    );

    logger.info('[CreativeMission] Updated mission status', {
      missionId: parsed.data.missionId,
      status: updated.status,
      userId: user.id,
    });

    revalidateMissionStatusPaths(parsed.data.missionId);
    return success({ missionId: parsed.data.missionId });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] updateMissionStatus', err));
  }
}
