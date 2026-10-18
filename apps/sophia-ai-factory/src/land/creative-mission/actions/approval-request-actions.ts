/**
 * @module land/creative-mission/actions/approval-request-actions
 * Approval request and pending listing Server Actions for creative missions.
 *
 * Layer: land — imports seed and tree only.
 */

'use server';

import type { z } from 'zod';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { createApproval, listPendingApprovals } from '@/tree/mission';
import { requestApprovalSchema, listPendingApprovalsSchema } from '../schemas';
import type { MissionError } from '../types';
import { actionFailure } from './action-helpers';
import {
  requireAuthAndDb,
  revalidateApprovalPaths,
  verifyMissionWorkspaceAccess,
} from './approval-request-helpers';

/** Request human approval for a sensitive action. */
export async function requestApproval(
  data: z.infer<typeof requestApprovalSchema>
): Promise<Result<{ approvalId: string }, MissionError>> {
  try {
    const parsed = requestApprovalSchema.safeParse(data);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const authCtx = await requireAuthAndDb();
    if (!authCtx.ok) return authCtx;

    const accessCtx = await verifyMissionWorkspaceAccess(
      parsed.data.missionId,
      authCtx.value.userId,
      authCtx.value.d1
    );
    if (!accessCtx.ok) return accessCtx;

    const approvalId = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    const result = await createApproval({
      id: approvalId,
      agentRunId: parsed.data.runId,
      actionId: parsed.data.agentId,
      actionType: 'mission_execution',
      actionSummary: parsed.data.reason,
      estimatedCostCents: undefined,
      timeoutAt: Math.floor(Date.now() / 1000) + 86400,
    });

    if (!result.ok) {
      return failure({ code: result.error.code, message: result.error.message });
    }

    logger.info('[Approval] Approval requested', {
      approvalId,
      missionId: parsed.data.missionId,
      agentId: parsed.data.agentId,
      runId: parsed.data.runId,
      userId: authCtx.value.userId,
      workspaceId: accessCtx.value.workspaceId,
    });

    revalidateApprovalPaths(parsed.data.missionId);
    return success({ approvalId });
  } catch (err) {
    return failure(actionFailure('[Approval] requestApproval', err));
  }
}

/** List pending approvals for the user's workspace. */
export async function listPendingApprovalsAction(
  data: { workspaceId: string; limit?: number; offset?: number }
): Promise<Result<{ approvals: Array<Record<string, unknown>>; count: number }, MissionError>> {
  try {
    const parsed = listPendingApprovalsSchema.safeParse(data);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const authCtx = await requireAuthAndDb();
    if (!authCtx.ok) return authCtx;

    const hasAccess = await verifyWorkspaceAccess(
      parsed.data.workspaceId,
      authCtx.value.userId,
      authCtx.value.d1
    );
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const result = await listPendingApprovals(
      parsed.data.workspaceId,
      parsed.data.limit ?? 50,
      parsed.data.offset ?? 0
    );

    if (!result.ok) {
      return failure({ code: result.error.code, message: result.error.message });
    }

    return success({
      approvals: result.value.approvals as unknown as Array<Record<string, unknown>>,
      count: result.value.count,
    });
  } catch (err) {
    return failure(actionFailure('[Approval] listPendingApprovalsAction', err));
  }
}
