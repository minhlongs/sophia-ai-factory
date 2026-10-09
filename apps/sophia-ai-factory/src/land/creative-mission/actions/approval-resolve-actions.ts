/**
 * @module land/creative-mission/actions/approval-resolve-actions
 * Approval resolution Server Actions for creative missions.
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
import { toError } from '@/seed/utils/to-error';
import { inngest } from '@/seed/inngest/client';
import { resolveApproval } from '@/tree/mission';
import { resolveApprovalSchema } from '../schemas';
import type { MissionError } from '../types';
import { actionFailure } from './action-helpers';

/**
 * Resolve an approval (approve or reject).
 * Only workspace owner or admin can resolve.
 */
export async function resolveApprovalAction(
  data: z.infer<typeof resolveApprovalSchema>
): Promise<Result<{ status: string }, MissionError>> {
  try {
    const parsed = resolveApprovalSchema.safeParse(data);
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

    // Fetch approval + linked agent run for workspace check
    const approval = await d1
      .prepare('SELECT * FROM agent_approvals WHERE id = ?')
      .bind(parsed.data.approvalId)
      .first<Record<string, unknown>>();

    if (!approval) {
      return failure({ code: 'NOT_FOUND', message: 'Approval not found' });
    }

    const agentRun = await d1
      .prepare('SELECT workspace_id FROM agent_runs WHERE id = ?')
      .bind(approval.agent_run_id as string)
      .first<{ workspace_id: string }>();

    if (!agentRun) {
      return failure({ code: 'NOT_FOUND', message: 'Agent run not found for this approval' });
    }

    // Verify workspace membership (IDOR prevention)
    const hasAccess = await verifyWorkspaceAccess(agentRun.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Verify user is admin/owner
    const hasAdmin = await hasWorkspaceRole(agentRun.workspace_id, user.id, 'ADMIN', d1);
    if (!hasAdmin) {
      return failure({ code: 'FORBIDDEN', message: 'Only workspace owner or admin can resolve approvals' });
    }

    const status = parsed.data.approved ? 'approved' : 'rejected';
    const result = await resolveApproval(
      parsed.data.approvalId,
      status,
      user.id,
      parsed.data.reason
    );

    if (!result.ok) {
      return failure({
        code: result.error.code,
        message: result.error.message,
      });
    }

    logger.info('[Approval] Approval resolved', {
      approvalId: parsed.data.approvalId,
      status,
      userId: user.id,
    });

    // Close the approval loop: notify the Inngest agent-approval-handler so it
    // resumes (approved) or fails (rejected) the agent run. Fire-and-forget —
    // an emit failure must never flip the approve/reject outcome returned below.
    const resolvedRow = result.value;
    const runId =
      typeof resolvedRow.agent_run_id === 'string'
        ? resolvedRow.agent_run_id
        : (approval.agent_run_id as string);
    try {
      await inngest.send({
        name: 'agent.approval.resolved',
        data: {
          approvalId: parsed.data.approvalId,
          runId,
          status,
          reviewerId: user.id,
          comment: parsed.data.reason,
        },
      });
    } catch (err) {
      logger.warn('[Approval] agent.approval.resolved emit failed (non-fatal)', {
        approvalId: parsed.data.approvalId,
        error: toError(err).message,
      });
    }

    // ── SIDE-CHANNEL: creative.accepted / creative.rejected (Q3) — non-fatal.
    try {
      const runRow = await d1
        .prepare('SELECT mission_id FROM agent_runs WHERE id = ?')
        .bind(runId)
        .first<{ mission_id: string | null }>();
      const { emitCreativeAccepted, emitCreativeRejected } = await import('@/tree/performance/loop-emitters-creative');
      if (runRow?.mission_id) {
        if (status === 'approved') {
          await emitCreativeAccepted({
            workspaceId: agentRun.workspace_id,
            missionId: runRow.mission_id,
            graphRunId: runId,
            nodeId: parsed.data.approvalId,
            assetId: '',
            agentSlug: 'human-approval',
            recordedAt: Date.now(),
          });
        } else {
          await emitCreativeRejected({
            workspaceId: agentRun.workspace_id,
            missionId: runRow.mission_id,
            graphRunId: runId,
            nodeId: parsed.data.approvalId,
            assetId: '',
            agentSlug: 'human-approval',
            reasonCode: parsed.data.reason ?? 'REJECTED',
            recordedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      logger.warn('[Approval] creative.accepted/rejected emit failed (non-fatal)', {
        approvalId: parsed.data.approvalId,
        status,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    revalidatePath('/dashboard/missions');
    revalidateTag('approvals', 'max');
    return success({ status });
  } catch (err) {
    return failure(actionFailure('[Approval] resolveApprovalAction', err));
  }
}
