/**
 * @module land/creative-mission/actions/multitrack-actions
 * Multi-track Server Actions for creative missions: synchronous execution.
 *
 * Layer: land — imports seed and tree only.
 */

'use server';

import type { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
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
import { executeMultiTrackMissionSchema } from '../schemas';
import type { MissionError } from '../types';
import { actionFailure } from './action-helpers';

/**
 * Synchronous server action to execute a multi-track creative mission.
 * Enforces Zod schema validation, authentication, workspace IDOR protection,
 * creator/admin role authorization, legal start-state checks, and the fail-closed
 * 7-gate preflight check before delegating to the multi-track orchestrator.
 */
export async function executeMultiTrackMissionAction(
  data: z.infer<typeof executeMultiTrackMissionSchema>
): Promise<Result<MultiTrackExecutionResult, MissionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const parsed = executeMultiTrackMissionSchema.safeParse(data);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const mission = await d1
      .prepare('SELECT workspace_id, creator_id, status FROM creative_missions WHERE id = ?')
      .bind(parsed.data.missionId)
      .first<{ workspace_id: string; creator_id: string; status: string }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    // 1. Verify workspace membership (IDOR prevention)
    const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // 2. Verify creator ownership or workspace ADMIN/OWNER role
    if (mission.creator_id !== user.id) {
      const hasAdmin = await hasWorkspaceRole(mission.workspace_id, user.id, 'ADMIN', d1);
      if (!hasAdmin) {
        return failure({ code: 'FORBIDDEN', message: 'You do not have permission to execute this mission' });
      }
    }

    // 3. Verify mission status allows starting execution
    if (!canStartExecution(mission.status as CreativeMissionStatus)) {
      return failure({
        code: 'EXECUTION_START_INVALID',
        message: `Mission status '${mission.status}' cannot start execution. Valid states: ${EXECUTION_START_FROM.join(', ')}`,
      });
    }

    // 4. 7-Gate Mission Preflight Check (fail-closed)
    const requiredCaps: AICapability[] =
      (parsed.data.requiredCapabilities as AICapability[]) ??
      ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'];

    const preflight = await runMissionPreflightCheck({
      userId: user.id,
      workspaceId: mission.workspace_id,
      requiredCapabilities: requiredCaps,
      estimatedCostCents: parsed.data.estimatedCostCents,
      overrides: { membershipVerified: true },
    });

    if (!preflight.passed) {
      logger.warn('[CreativeMission] executeMultiTrackMissionAction rejected by preflight', {
        missionId: parsed.data.missionId,
        failureCode: preflight.failureCode,
        failureReason: preflight.failureReason,
      });
      return failure({
        code: preflight.failureCode ?? 'PREFLIGHT_FAILED',
        message: preflight.failureReason ?? 'Mission preflight check failed',
      });
    }

    // 5. Delegate to Tree Service Bridge
    const { dispatchMultiTrackMission } = await import('@/tree/mission');
    const result = await dispatchMultiTrackMission(parsed.data.missionId, {
      userId: user.id,
      workspaceId: mission.workspace_id,
      topic: parsed.data.topic,
      estimatedScenes: parsed.data.estimatedScenes,
      durationSeconds: parsed.data.durationSeconds,
      aspectRatio: parsed.data.aspectRatio,
      estimatedCostCents: parsed.data.estimatedCostCents,
    });

    if (!result.success) {
      return failure({ code: 'EXECUTION_FAILED', message: result.error || 'Multi-track execution failed' });
    }

    revalidatePath('/dashboard/missions');
    revalidatePath(`/[locale]/dashboard/missions/${parsed.data.missionId}`);
    revalidateTag('missions', 'max');
    revalidateTag(`mission_${parsed.data.missionId}`, 'max');
    return success(result);
  } catch (err) {
    return failure(actionFailure('[CreativeMission] executeMultiTrackMissionAction', err));
  }
}
