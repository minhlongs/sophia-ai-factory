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
import { inngest } from '@/seed/inngest/client';
import { sendInngestWithRetry } from '@/seed/inngest/send-with-retry';
import { runMissionPreflightCheck } from '@/tree/mission/preflight-check';
import { beginMissionExecution } from '@/tree/mission';
import type { AICapability } from '@/seed/ai/capability-model';
import { startMissionExecutionSchema } from '../schemas';
import type { MissionError } from '../types';
import { actionFailure } from './action-helpers';

/**
 * Start mission execution: atomically flips the mission to 'running' (phase
 * 'executing') via the tree authority — legal only from draft/planned/
 * approval_required/paused — then emits agent.mission.started. The
 * agent-mission-executor writes agent_runs only; on success the lifecycle
 * path advances the mission to 'review' for human review of artifacts.
 */
export async function startMissionExecution(
  data: z.infer<typeof startMissionExecutionSchema>
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

    // Get mission to verify ownership and workspace
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

    // Verify workspace membership (IDOR prevention)
    const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // ─── 7-Gate Mission Preflight ──────────────────────────────────────────
    // Fail-closed: all 7 gates must pass before flipping mission to 'running'.
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

    // Atomic 'running' flip via the tree authority — invalid start states and
    // concurrent writers reject BEFORE any Inngest event is emitted.
    await beginMissionExecution(parsed.data.missionId);

    // Emit Inngest event to trigger agent execution with retry and safe rollback
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      await sendInngestWithRetry(() =>
        inngest.send({
          id: runId,
          name: 'agent.mission.started',
          data: {
            runId,
            agentId: parsed.data.agentId,
            missionId: parsed.data.missionId,
            workspaceId: mission.workspace_id,
            autonomyLevel: parsed.data.autonomyLevel,
          },
          ts: Date.now(),
        }),
      );
    } catch (sendErr) {
      logger.error('[CreativeMission] inngest.send failed, rolling back mission status', {
        missionId: parsed.data.missionId,
        runId,
        previousStatus: mission.status,
        error: sendErr instanceof Error ? sendErr.message : String(sendErr),
      });

      // Rollback mission in D1 to prevent permanent 'running' lockout
      const db = await getD1();
      if (db) {
        try {
          await db
            .prepare(
              `UPDATE creative_missions
               SET status = ?, current_phase = ?, updated_at = ?
               WHERE id = ? AND status = 'running'`,
            )
            .bind(
              mission.status,
              mission.current_phase ?? 'init',
              Math.floor(Date.now() / 1000),
              parsed.data.missionId,
            )
            .run();
        } catch (rollbackErr) {
          logger.error('[CreativeMission] Failed to rollback mission status', {
            missionId: parsed.data.missionId,
            error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
          });
        }
      }

      throw sendErr;
    }

    // Trigger multi-track orchestrator via Tree Service Bridge
    try {
      const { dispatchMultiTrackMission } = await import('@/tree/mission');
      void dispatchMultiTrackMission(parsed.data.missionId, {
        userId: user.id,
        workspaceId: mission.workspace_id,
      }).catch((orchErr) => {
        logger.error('[CreativeMission] dispatchMultiTrackMission async execution failed', {
          missionId: parsed.data.missionId,
          error: orchErr instanceof Error ? orchErr.message : String(orchErr),
        });
      });
    } catch (importErr) {
      logger.warn('[CreativeMission] multi-track dispatch skipped', {
        error: importErr instanceof Error ? importErr.message : String(importErr),
      });
    }

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
