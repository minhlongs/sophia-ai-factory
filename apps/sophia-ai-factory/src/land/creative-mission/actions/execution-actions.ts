/**
 * @module land/creative-mission/actions/execution-actions
 * Execution Server Actions for creative missions: start execution.
 *
 * Layer: land — imports seed and tree only.
 */

'use server';

import type { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { runMissionPreflightCheck } from '@/tree/mission/preflight-check';
import { beginMissionExecution } from '@/tree/mission';
import type { AICapability } from '@/seed/ai/capability-model';
import { startMissionExecutionSchema } from '../schemas';
import type { MissionError } from '../types';
import { actionFailure } from './action-helpers';
import {
  dispatchMissionInngestWithRollback,
  triggerMultiTrackMissionAsync,
} from './execution-action-helpers';

export async function startMissionExecution(
  data: z.infer<typeof startMissionExecutionSchema>,
): Promise<Result<{ runId: string; agentId: string }, MissionError>> {
  try {
    const parsed = startMissionExecutionSchema.safeParse(data);
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

    const mission = await d1
      .prepare('SELECT * FROM creative_missions WHERE id = ?')
      .bind(parsed.data.missionId)
      .first<{
        workspace_id: string;
        creator_id: string;
        status: string;
        current_phase?: string | null;
      }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const requiredCaps: AICapability[] =
      (parsed.data.requiredCapabilities as AICapability[]) ??
      ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'];

    const preflight = await runMissionPreflightCheck({
      userId: user.id,
      workspaceId: mission.workspace_id,
      estimatedCostCents: parsed.data.estimatedCostCents,
      requiredCapabilities: requiredCaps,
      overrides: {
        membershipVerified: true,
      },
    });

    if (!preflight.passed) {
      return failure({
        code: preflight.failureCode ?? 'PREFLIGHT_FAILED',
        message: preflight.failureReason ?? 'Mission preflight check failed',
      });
    }

    await beginMissionExecution(parsed.data.missionId);

    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await dispatchMissionInngestWithRollback({
      runId,
      agentId: parsed.data.agentId,
      missionId: parsed.data.missionId,
      workspaceId: mission.workspace_id,
      autonomyLevel: parsed.data.autonomyLevel,
      previousStatus: mission.status,
      previousPhase: mission.current_phase,
    });

    await triggerMultiTrackMissionAsync(parsed.data.missionId, user.id, mission.workspace_id);

    logger.info('[CreativeMission] Started mission execution', {
      missionId: parsed.data.missionId,
      runId,
      agentId: parsed.data.agentId,
      userId: user.id,
    });

    revalidatePath('/dashboard/missions');
    revalidatePath(`/[locale]/dashboard/missions/${parsed.data.missionId}`);
    revalidateTag('missions', 'max');
    revalidateTag(`mission_${parsed.data.missionId}`, 'max');
    return success({ runId, agentId: parsed.data.agentId });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] startMissionExecution', err));
  }
}
