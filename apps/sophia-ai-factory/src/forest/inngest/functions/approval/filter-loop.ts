/**
 * Agent Approval Gate Filter-Loop Adapter
 * Layer: FOREST (Infrastructure Orchestration)
 */

import { logger } from '@/seed/utils/logger-utility';
import type { ApprovalGateStep, ResolvedData } from './types';

/** Upper bound on filter-loop passes to guarantee termination. */
export const MAX_FILTER_PASSES = 64;

/**
 * Filter-loop adapter: wait for the `agent.approval.resolved` event whose
 * `approvalId` matches. Returns the resolved payload, or null on timeout.
 */
export async function waitForResolution(
  step: ApprovalGateStep,
  args: { approvalId: string; timeoutMs: number; attempt: number; nowMs: () => number }
): Promise<ResolvedData | null> {
  const deadline = args.nowMs() + args.timeoutMs;
  for (let pass = 0; pass < MAX_FILTER_PASSES; pass += 1) {
    const remaining = deadline - args.nowMs();
    if (remaining <= 0) return null;
    const stepId = `await-approval-${args.approvalId}-a${args.attempt}-p${pass}`;
    const event = await step.waitForEvent(stepId, {
      event: 'agent.approval.resolved',
      timeout: remaining,
    });
    if (event === null) return null;
    if (event.data.approvalId === args.approvalId) return event.data;
    logger.info('agentApprovalGate: ignoring resolved event for another approval', {
      wanted: args.approvalId,
      got: event.data.approvalId,
    });
  }
  return null;
}
