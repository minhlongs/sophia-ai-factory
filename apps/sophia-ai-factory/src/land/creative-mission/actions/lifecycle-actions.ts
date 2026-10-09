/**
 * @module land/creative-mission/actions/lifecycle-actions
 * Lifecycle Server Actions for creative missions: create and update status.
 *
 * Layer: land — imports seed and tree only.
 */

'use server';

import type { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  verifyWorkspaceAccess,
  hasWorkspaceRole,
} from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { updateMissionStatus as treeUpdateMissionStatus } from '@/tree/mission';
import { createMissionSchema, updateMissionStatusSchema } from '../schemas';
import type { MissionAction, MissionError } from '../types';
import { actionFailure } from './action-helpers';

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

    // Verify workspace membership (IDOR prevention)
    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Create the mission via tree layer
    const mission = await import('@/tree/mission').then((mod) =>
      mod.createMission({
        id: '',
        workspaceId: parsed.data.workspaceId,
        creatorId: user.id,
        brandId: parsed.data.brandId,
        title: parsed.data.title,
        objective: parsed.data.objective,
        audience: parsed.data.audience,
        geography: parsed.data.geography,
        timeframeStart: parsed.data.timeframeStart,
        timeframeEnd: parsed.data.timeframeEnd,
        budgetCents: parsed.data.budgetCents,
        spentCents: 0,
        autonomyLevel: parsed.data.autonomyLevel as 0 | 1 | 2 | 3 | 4,
        channels: parsed.data.channels,
        monetizationGoals: parsed.data.monetizationGoals,
        constraints: parsed.data.constraints,
        successMetrics: parsed.data.successMetrics,
        status: 'draft',
        currentPhase: 'init',
        createdAt: 0,
        updatedAt: 0,
      })
    );

    logger.info('[CreativeMission] Created mission', {
      missionId: mission.id,
      workspaceId: parsed.data.workspaceId,
      userId: user.id,
    });

    // ── SIDE-CHANNEL: mission.created (Q9/Q10 funnel entry) — non-fatal.
    // Fires AFTER the row commit so the event never appears if creation
    // rolled back. Telemetry failure must not abort the 201 path.
    try {
      const { emitMissionCreated } = await import('@/tree/performance/loop-emitters-runner');
      await emitMissionCreated({
        workspaceId: parsed.data.workspaceId,
        missionId: mission.id,
        autonomyLevel: parsed.data.autonomyLevel,
        budgetCents: parsed.data.budgetCents,
        recordedAt: Date.now(),
      });
    } catch (err) {
      logger.warn('[CreativeMission.createMission] mission.created emit failed (non-fatal)', {
        missionId: mission.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    revalidatePath('/dashboard/missions');
    revalidatePath('/[locale]/dashboard/missions');
    revalidateTag('missions', 'max');
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

    // Read only what permission checks need; transitions belong to tree.
    const mission = await d1
      .prepare('SELECT workspace_id, creator_id, current_phase FROM creative_missions WHERE id = ?')
      .bind(parsed.data.missionId)
      .first<{ workspace_id: string; creator_id: string; current_phase: string }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    // Verify workspace membership (IDOR prevention)
    const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Verify ownership or admin access
    const isCreator = mission.creator_id === user.id;
    if (!isCreator) {
      // Check if user is workspace admin/owner
      const hasAdmin = await hasWorkspaceRole(mission.workspace_id, user.id, 'ADMIN', d1);
      if (!hasAdmin) {
        return failure({ code: 'FORBIDDEN', message: 'You do not have permission to update this mission' });
      }
    }

    // Single transition authority: validation, optimistic concurrency guard,
    // and the write live in the tree layer. Phase preserved (status-only).
    const updated = await treeUpdateMissionStatus(
      parsed.data.missionId,
      parsed.data.status,
      mission.current_phase
    );

    logger.info('[CreativeMission] Updated mission status', {
      missionId: parsed.data.missionId,
      status: updated.status,
      userId: user.id,
    });

    revalidatePath('/dashboard/missions');
    revalidatePath(`/[locale]/dashboard/missions/${parsed.data.missionId}`);
    revalidateTag('missions', 'max');
    revalidateTag(`mission_${parsed.data.missionId}`, 'max');
    return success({ missionId: parsed.data.missionId });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] updateMissionStatus', err));
  }
}
