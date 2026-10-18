/**
 * Helper utilities for creative mission lifecycle actions.
 * @module land/creative-mission/actions/lifecycle-action-helpers
 */

import type { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  verifyWorkspaceAccess,
  hasWorkspaceRole,
} from '@/seed/auth/workspace-access';
import type { D1Database } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { createMissionSchema } from '../schemas';
import type { MissionError } from '../types';

export async function createMissionAndEmitTelemetry(
  parsedData: z.infer<typeof createMissionSchema>,
  userId: string,
): Promise<{ id: string }> {
  const mission = await import('@/tree/mission').then((mod) =>
    mod.createMission({
      id: '',
      workspaceId: parsedData.workspaceId,
      creatorId: userId,
      brandId: parsedData.brandId,
      title: parsedData.title,
      objective: parsedData.objective,
      audience: parsedData.audience,
      geography: parsedData.geography,
      timeframeStart: parsedData.timeframeStart,
      timeframeEnd: parsedData.timeframeEnd,
      budgetCents: parsedData.budgetCents,
      spentCents: 0,
      autonomyLevel: parsedData.autonomyLevel as 0 | 1 | 2 | 3 | 4,
      channels: parsedData.channels,
      monetizationGoals: parsedData.monetizationGoals,
      constraints: parsedData.constraints,
      successMetrics: parsedData.successMetrics,
      status: 'draft',
      currentPhase: 'init',
      createdAt: 0,
      updatedAt: 0,
    }),
  );

  logger.info('[CreativeMission] Created mission', {
    missionId: mission.id,
    workspaceId: parsedData.workspaceId,
    userId,
  });

  try {
    const { emitMissionCreated } = await import('@/tree/performance/loop-emitters-runner');
    await emitMissionCreated({
      workspaceId: parsedData.workspaceId,
      missionId: mission.id,
      autonomyLevel: parsedData.autonomyLevel,
      budgetCents: parsedData.budgetCents,
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
  return mission;
}

export function revalidateMissionStatusPaths(missionId: string): void {
  revalidatePath('/dashboard/missions');
  revalidatePath(`/[locale]/dashboard/missions/${missionId}`);
  revalidateTag('missions', 'max');
  revalidateTag(`mission_${missionId}`, 'max');
}

export async function authorizeMissionStatusUpdate(
  d1: D1Database,
  missionId: string,
  userId: string,
): Promise<Result<{ currentPhase: string }, MissionError>> {
  const mission = await d1
    .prepare('SELECT workspace_id, creator_id, current_phase FROM creative_missions WHERE id = ?')
    .bind(missionId)
    .first<{ workspace_id: string; creator_id: string; current_phase: string }>();

  if (!mission) {
    return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
  }

  const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, userId, d1);
  if (!hasAccess) {
    return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
  }

  if (mission.creator_id !== userId) {
    const hasAdmin = await hasWorkspaceRole(mission.workspace_id, userId, 'ADMIN', d1);
    if (!hasAdmin) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have permission to update this mission' });
    }
  }

  return success({ currentPhase: mission.current_phase });
}
