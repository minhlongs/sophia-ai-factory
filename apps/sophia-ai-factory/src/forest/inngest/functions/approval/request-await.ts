/**
 * Agent Approval Gate Request & Await Orchestration
 * Layer: FOREST (Infrastructure Orchestration)
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  createApproval,
  markRunAwaitingApproval,
  failAwaitingRun,
} from '@/tree/mission/agent-run-repo';
import type { ApprovalGateInput, ApprovalGateDeps, ApprovalDecision } from './types';
import { waitForResolution } from './filter-loop';

/**
 * Create the approval, suspend the run, emit `agent.approval.requested`, then
 * await resolution. Returns the terminal decision; on rejected/timeout the run
 * is marked failed with the matching error code (guarded, idempotent).
 */
export async function requestApprovalAndAwait(
  input: ApprovalGateInput,
  deps: ApprovalGateDeps
): Promise<ApprovalDecision> {
  const { step } = deps;
  const nowMs = deps.nowMs ?? Date.now;
  const attempt = input.attempt ?? 0;

  const approvalId = await step.run(`gen-approval-id-${input.runId}-${input.actionId}`, async () => {
    if (input.approvalId) return input.approvalId;
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  });

  const timeoutAtSec = Math.floor((nowMs() + input.timeoutMs) / 1000);

  await step.run(`create-approval-${approvalId}`, async () => {
    const created = await createApproval({
      id: approvalId,
      agentRunId: input.runId,
      actionId: input.actionId,
      actionType: input.actionType,
      actionSummary: input.actionSummary,
      estimatedCostCents: input.estimatedCostCents,
      timeoutAt: timeoutAtSec,
    });
    if (!created.ok) throw new Error(`createApproval failed: ${created.error.code} ${created.error.message}`);
    return created.value;
  });

  const flip = await step.run(`flip-awaiting-${approvalId}`, async () => {
    const result = await markRunAwaitingApproval(input.runId);
    if (!result.ok) throw new Error(`markRunAwaitingApproval failed: ${result.error.code} ${result.error.message}`);
    return result.value;
  });
  if (!flip.flipped) {
    logger.warn('agentApprovalGate: run not in running state, skipping gate', { runId: input.runId, approvalId });
    return { outcome: 'skipped', reason: 'run_not_running' };
  }

  await step.sendEvent(`emit-approval-requested-${approvalId}`, {
    name: 'agent.approval.requested',
    data: {
      runId: input.runId,
      approvalId,
      actionType: input.actionType,
      actionSummary: input.actionSummary,
      missionId: input.missionId,
    },
  });

  const resolved = await waitForResolution(step, {
    approvalId,
    timeoutMs: input.timeoutMs,
    attempt,
    nowMs,
  });

  if (resolved === null) {
    await step.run(`fail-timeout-${approvalId}`, async () => {
      const result = await failAwaitingRun(
        input.runId,
        { code: 'APPROVAL_TIMEOUT', approvalId },
        'Approval timed out before review'
      );
      if (!result.ok) throw new Error(`failAwaitingRun failed: ${result.error.code} ${result.error.message}`);
      return result.value;
    });
    logger.info('agentApprovalGate: approval timed out', { runId: input.runId, approvalId });
    return { outcome: 'timeout' };
  }

  if (resolved.status === 'rejected') {
    await step.run(`fail-rejected-${approvalId}`, async () => {
      const result = await failAwaitingRun(
        input.runId,
        { code: 'APPROVAL_REJECTED', approvalId, reviewerId: resolved.reviewerId, comment: resolved.comment },
        resolved.comment ?? 'Approval rejected by reviewer'
      );
      if (!result.ok) throw new Error(`failAwaitingRun failed: ${result.error.code} ${result.error.message}`);
      return result.value;
    });
    logger.info('agentApprovalGate: approval rejected', { runId: input.runId, approvalId });
    return { outcome: 'rejected', reviewerId: resolved.reviewerId, comment: resolved.comment };
  }

  logger.info('agentApprovalGate: approval granted', { runId: input.runId, approvalId });
  return {
    outcome: 'approved',
    approvedActionIds: [input.actionId],
    reviewerId: resolved.reviewerId,
    comment: resolved.comment,
  };
}
