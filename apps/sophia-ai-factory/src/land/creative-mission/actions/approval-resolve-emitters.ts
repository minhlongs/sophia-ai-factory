/**
 * @module land/creative-mission/actions/approval-resolve-emitters
 * Non-fatal side-channel emitters for approval resolution (Inngest + reality-loop).
 *
 * Layer: land — imports seed and tree only.
 */

import type { getD1 } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

type D1Binding = NonNullable<Awaited<ReturnType<typeof getD1>>>;

export interface ApprovalResolvedEmitInput {
  d1: D1Binding;
  approvalId: string;
  runId: string;
  workspaceId: string;
  status: 'approved' | 'rejected';
  reviewerId: string;
  reason?: string;
}

/**
 * Emit `agent.approval.resolved` to Inngest and `creative.accepted` / `creative.rejected`
 * to reality-loop performance emitters. Fire-and-forget / non-fatal.
 */
export async function emitApprovalResolutionEvents(
  input: ApprovalResolvedEmitInput
): Promise<void> {
  const { d1, approvalId, runId, workspaceId, status, reviewerId, reason } = input;

  try {
    await inngest.send({
      name: 'agent.approval.resolved',
      data: {
        approvalId,
        runId,
        status,
        reviewerId,
        comment: reason,
      },
    });
  } catch (err) {
    logger.warn('[Approval] agent.approval.resolved emit failed (non-fatal)', {
      approvalId,
      error: toError(err).message,
    });
  }

  try {
    const runRow = await d1
      .prepare('SELECT mission_id FROM agent_runs WHERE id = ?')
      .bind(runId)
      .first<{ mission_id: string | null }>();
    const { emitCreativeAccepted, emitCreativeRejected } = await import(
      '@/tree/performance/loop-emitters-creative'
    );
    if (runRow?.mission_id) {
      if (status === 'approved') {
        await emitCreativeAccepted({
          workspaceId,
          missionId: runRow.mission_id,
          graphRunId: runId,
          nodeId: approvalId,
          assetId: '',
          agentSlug: 'human-approval',
          recordedAt: Date.now(),
        });
      } else {
        await emitCreativeRejected({
          workspaceId,
          missionId: runRow.mission_id,
          graphRunId: runId,
          nodeId: approvalId,
          assetId: '',
          agentSlug: 'human-approval',
          reasonCode: reason ?? 'REJECTED',
          recordedAt: Date.now(),
        });
      }
    }
  } catch (err) {
    logger.warn('[Approval] creative.accepted/rejected emit failed (non-fatal)', {
      approvalId,
      status,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
