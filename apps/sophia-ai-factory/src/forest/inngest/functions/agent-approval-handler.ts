/**
 * Agent Approval Handler — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Handles approval resolution and timeout for agent runs.
 * Triggered by `agent.approval.resolved` event or approval timeout.
 *
 * @module forest/inngest/functions
 */

import { inngest } from '@/tree/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { resolveApproval, getAgentRun, updateAgentRun } from '@/tree/mission/agent-run-repo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalResolvedData {
  approvalId: string;
  runId: string;
  status: 'approved' | 'rejected';
  reviewerId: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Inngest function
// ---------------------------------------------------------------------------

export const agentApprovalHandler = inngest.createFunction(
  {
    id: 'agent-approval-handler',
    retries: 2,
  },
  { event: 'agent.approval.resolved' },
  async ({ event }) => {
    const data = event.data as ApprovalResolvedData;
    const { approvalId, runId, status, reviewerId, comment } = data;

    logger.info('agentApprovalHandler: approval resolved', { approvalId, runId, status });

    const resolved = await resolveApproval(approvalId, status, reviewerId, comment);
    if (!resolved.ok) {
      const code = resolved.error?.code ?? 'UNKNOWN';
      const message = resolved.error?.message ?? 'Failed to resolve approval';
      if (code === 'ALREADY_RESOLVED') {
        logger.warn('agentApprovalHandler: approval already resolved', { approvalId });
        return { skipped: true, reason: 'already_resolved' };
      }
      logger.error('agentApprovalHandler: resolveApproval failed', { approvalId, error: resolved.error });
      throw new Error(`Failed to resolve approval ${approvalId}: ${message}`);
    }

    // Update AgentRun status: resume execution if approved, mark review if rejected
    const runResult = await getAgentRun(runId);
    if (!runResult.ok || !runResult.value) {
      logger.error('agentApprovalHandler: agent_run not found', { runId });
      throw new Error(`AgentRun ${runId} not found`);
    }

    if (status === 'rejected') {
      const updateResult = await updateAgentRun(runId, {
        status: 'failed',
        phase: 'failed',
        errorMessage: comment ?? 'Approval rejected by reviewer',
        errorJson: { code: 'APPROVAL_REJECTED', reviewerId, comment } as Record<string, unknown>,
        endedAt: Math.floor(Date.now() / 1000),
      });

      if (!updateResult.ok) {
        logger.error('agentApprovalHandler: failed to mark run rejected', { runId, error: updateResult.error });
      }

      logger.info('agentApprovalHandler: run marked as failed (rejected)', { runId, approvalId });
      return { approved: false, runId, approvalId };
    }

    // Approved: return signal for executor to resume (step.waitForEvent correlation)
    logger.info('agentApprovalHandler: approval granted, run can resume', { runId, approvalId });
    return { approved: true, runId, approvalId, reviewerId, comment };
  }
);