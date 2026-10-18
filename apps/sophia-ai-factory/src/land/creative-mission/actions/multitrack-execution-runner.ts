/**
 * @module land/creative-mission/actions/multitrack-execution-runner
 * Multi-track mission authorization, preflight verification, and execution runner.
 *
 * Layer: land — imports seed and tree only.
 */

import type { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { verifyWorkspaceAccess, hasWorkspaceRole } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  canStartExecution,
  EXECUTION_START_FROM,
  type MultiTrackExecutionResult,
} from '@/tree/mission';
import type { CreativeMissionStatus } from '@/seed/types/creative-economy';
import { runMissionPreflightCheck } from '@/tree/mission/preflight-check';
import type { AICapability } from '@/seed/ai/capability-model';
import type { executeMultiTrackMissionSchema } from '../schemas';
import type { MissionError } from '../types';

export type ParsedMultiTrackInput = z.infer<typeof executeMultiTrackMissionSchema>;

export async function runAuthorizedMultiTrackMission(
  userId: string,
  input: ParsedMultiTrackInput,
): Promise<Result<MultiTrackExecutionResult, MissionError>> {
  const d1 = await getD1();
  if (!d1) {
    return failure({ code: 'DB_ERROR', message: 'Database not available' });
  }

  const mission = await d1
    .prepare('SELECT workspace_id, creator_id, status FROM creative_missions WHERE id = ?')
    .bind(input.missionId)
    .first<{ workspace_id: string; creator_id: string; status: string }>();

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
      return failure({ code: 'FORBIDDEN', message: 'You do not have permission to execute this mission' });
    }
  }

  if (!canStartExecution(mission.status as CreativeMissionStatus)) {
    return failure({
      code: 'EXECUTION_START_INVALID',
      message: `Mission status '${mission.status}' cannot start execution. Valid states: ${EXECUTION_START_FROM.join(', ')}`,
    });
  }

  const requiredCaps: AICapability[] =
    (input.requiredCapabilities as AICapability[]) ??
    ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'];

  const preflight = await runMissionPreflightCheck({
    userId,
    workspaceId: mission.workspace_id,
    requiredCapabilities: requiredCaps,
    estimatedCostCents: input.estimatedCostCents,
    overrides: { membershipVerified: true },
  });

  if (!preflight.passed) {
    logger.warn('[CreativeMission] executeMultiTrackMissionAction rejected by preflight', {
      missionId: input.missionId,
      failureCode: preflight.failureCode,
      failureReason: preflight.failureReason,
    });
    return failure({
      code: preflight.failureCode ?? 'PREFLIGHT_FAILED',
      message: preflight.failureReason ?? 'Mission preflight check failed',
    });
  }

  const { dispatchMultiTrackMission } = await import('@/tree/mission');
  const result = await dispatchMultiTrackMission(input.missionId, {
    userId,
    workspaceId: mission.workspace_id,
    topic: input.topic,
    estimatedScenes: input.estimatedScenes,
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio,
    estimatedCostCents: input.estimatedCostCents,
  });

  if (!result.success) {
    return failure({ code: 'EXECUTION_FAILED', message: result.error || 'Multi-track execution failed' });
  }

  revalidatePath('/dashboard/missions');
  revalidatePath(`/[locale]/dashboard/missions/${input.missionId}`);
  revalidateTag('missions', 'max');
  revalidateTag(`mission_${input.missionId}`, 'max');
  return success(result);
}
