/**
 * Helper utilities for creative mission lifecycle actions.
 * @module land/creative-mission/actions/lifecycle-action-helpers
 */

import type { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { logger } from '@/seed/utils/logger-utility';
import { createMissionSchema } from '../schemas';

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
