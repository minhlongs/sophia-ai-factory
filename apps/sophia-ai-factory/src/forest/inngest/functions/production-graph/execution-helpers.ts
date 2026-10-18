/**
 * Production Graph Runner Execution State & Helpers.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/execution-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { setNodeStates } from '@/tree/production-graph/repo';
import {
  serializeNodeStates,
  type GraphNodeRuntimeState,
} from '@/tree/production-graph/types';
import type { ApprovalDecision, ApprovalGateStep } from '../agent-approval-gate';
import type { RunnerContext } from './types';

export {
  recordSpendSafe,
  recordNodePerformance,
} from './execution-telemetry-helpers';

/** Check if the run has been cancelled by reading the current status from DB. */
export async function checkCancellation(
  ctx: RunnerContext,
): Promise<{ cancelled: boolean; reason?: string }> {
  try {
    const runResult = await ctx.getRun(ctx.graphRunId);
    if (!runResult.ok || !runResult.value) {
      return { cancelled: false };
    }
    if (runResult.value.status === 'cancelled') {
      const errorJson = runResult.value.errorJson;
      let reason = 'Cancelled by user';
      if (errorJson) {
        try {
          const parsed = JSON.parse(errorJson) as {
            message?: string;
            details?: { reason?: string };
          };
          reason = parsed.message ?? parsed.details?.reason ?? reason;
        } catch {
          // Ignore parse errors, use default reason
        }
      }
      return { cancelled: true, reason };
    }
    return { cancelled: false };
  } catch {
    return { cancelled: false };
  }
}

/** Adapt the Inngest step to the approval gate's step contract. */
export function toApprovalGateStep(step: unknown): ApprovalGateStep {
  return step as ApprovalGateStep;
}

/** Map an approval decision to a gate outcome. */
export function handleApprovalDecision(
  decision: ApprovalDecision,
  graphRunId: string,
): 'approved' | 'rejected' | 'timeout' {
  switch (decision.outcome) {
    case 'approved':
      return 'approved';
    case 'skipped':
      logger.info('productionGraphRunner: approval gate skipped', {
        graphRunId,
        reason: decision.reason,
      });
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'timeout':
      return 'timeout';
  }
}

/** Persist the current node states as the resume checkpoint. */
export async function checkpoint(
  graphRunId: string,
  states: ReadonlyMap<string, GraphNodeRuntimeState>,
): Promise<void> {
  const result = await setNodeStates(graphRunId, serializeNodeStates(states));
  if (!result.ok) {
    logger.warn('productionGraphRunner: checkpoint write failed (non-fatal)', {
      graphRunId,
      error: result.error.message,
    });
  }
}

/** Mark a node failed in the in-memory state map. */
export function markNodeFailed(
  states: Map<string, GraphNodeRuntimeState>,
  nodeId: string,
  errorMessage: string,
  nowMs: () => number,
): void {
  const state = states.get(nodeId);
  if (!state) return;
  state.status = 'failed';
  state.errorMessage = errorMessage;
  state.endedAt = nowMs();
}
