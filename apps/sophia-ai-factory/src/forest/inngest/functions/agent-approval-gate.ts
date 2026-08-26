/**
 * Agent Approval Gate — request a human approval and suspend the run until it
 * is resolved (approved / rejected / timed out).
 *
 * Layer: forest (reusable infrastructure orchestrators). Imports seed + tree.
 *
 * This module is the FIRST sender of `agent.approval.requested`. The resolved
 * side (`agent.approval.resolved`) is emitted fire-and-forget by
 * land/creative-mission/actions and consumed by agent-approval-handler.ts.
 *
 * Correlation note: Inngest `waitForEvent` `match`/`if` compare a field against
 * the TRIGGERING event only. The trigger here carries no `approvalId`, so static
 * correlation is impossible. Instead `waitForResolution` runs a filter-loop that
 * inspects each `agent.approval.resolved` event and wakes only when the
 * `approvalId` matches. The step id is unique per retry attempt so a re-run
 * creates a fresh wait instead of replaying a memoized one.
 *
 * Everything is dependency-injected (the Inngest `step`) so tests drive it with
 * a deterministic fake step and zero network.
 *
 * @module forest/inngest/functions/agent-approval-gate
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  createApproval,
  markRunAwaitingApproval,
  failAwaitingRun,
} from '@/tree/mission/agent-run-repo';
import type {
  AgentApprovalRequestedData,
  AgentApprovalResolvedData,
} from '@/seed/inngest/agent-event-types';

type RequestedData = AgentApprovalRequestedData['data'];
type ResolvedData = AgentApprovalResolvedData['data'];

/** The slice of the Inngest step tools this gate needs (injectable for tests). */
export interface ApprovalGateStep {
  run<T>(id: string, fn: () => Promise<T>): Promise<T>;
  sendEvent(
    id: string,
    payload: { name: 'agent.approval.requested'; data: RequestedData }
  ): Promise<unknown>;
  waitForEvent(
    id: string,
    opts: { event: 'agent.approval.resolved'; timeout: number }
  ): Promise<AgentApprovalResolvedData | null>;
}

/** Input describing the single action that needs human approval. */
export interface ApprovalGateInput {
  runId: string;
  missionId: string;
  actionId: string;
  actionType: string;
  actionSummary: string;
  estimatedCostCents?: number;
  /** How long to wait for a human before timing out (milliseconds). */
  timeoutMs: number;
  /** Optional stable approval id; generated (memoized) when omitted. */
  approvalId?: string;
  /** Retry attempt index — makes wait step ids unique across retries. */
  attempt?: number;
}

/** Terminal outcome of the gate. */
export type ApprovalDecision =
  | { outcome: 'approved'; approvedActionIds: string[]; reviewerId: string; comment?: string }
  | { outcome: 'rejected'; reviewerId: string; comment?: string }
  | { outcome: 'timeout' }
  | { outcome: 'skipped'; reason: string };

export interface ApprovalGateDeps {
  step: ApprovalGateStep;
  /** Injectable clock for deterministic timeout math (defaults to Date.now). */
  nowMs?: () => number;
}

/** Upper bound on filter-loop passes to guarantee termination. */
const MAX_FILTER_PASSES = 64;

/**
 * Filter-loop adapter: wait for the `agent.approval.resolved` event whose
 * `approvalId` matches. Returns the resolved payload, or null on timeout.
 */
async function waitForResolution(
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

  // Stable approval id: caller-provided, or generated once and memoized so a
  // retry reuses the same id (INSERT is then idempotent via step.run memo).
  const approvalId = await step.run(`gen-approval-id-${input.runId}-${input.actionId}`, async () => {
    if (input.approvalId) return input.approvalId;
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  });

  const timeoutAtSec = Math.floor((nowMs() + input.timeoutMs) / 1000);

  // 1. Create the approval row (memoized; throws on failure so Inngest retries).
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
    if (!created.ok) {
      throw new Error(`createApproval failed: ${created.error.code} ${created.error.message}`);
    }
    return created.value;
  });

  // 2. Guarded flip running → awaiting_approval. If the run already moved on
  //    (completed/cancelled concurrently) the gate is moot — skip, do not fail.
  const flip = await step.run(`flip-awaiting-${approvalId}`, async () => {
    const result = await markRunAwaitingApproval(input.runId);
    if (!result.ok) {
      throw new Error(`markRunAwaitingApproval failed: ${result.error.code} ${result.error.message}`);
    }
    return result.value;
  });
  if (!flip.flipped) {
    logger.warn('agentApprovalGate: run not in running state, skipping gate', {
      runId: input.runId,
      approvalId,
    });
    return { outcome: 'skipped', reason: 'run_not_running' };
  }

  // 3. Emit agent.approval.requested (first sender of this event).
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

  // 4. Await resolution via the filter-loop adapter.
  const resolved = await waitForResolution(step, {
    approvalId,
    timeoutMs: input.timeoutMs,
    attempt,
    nowMs,
  });

  // 5a. Timeout: mark the run failed (guarded; cron is the safety net).
  if (resolved === null) {
    await step.run(`fail-timeout-${approvalId}`, async () => {
      const result = await failAwaitingRun(
        input.runId,
        { code: 'APPROVAL_TIMEOUT', approvalId },
        'Approval timed out before review'
      );
      if (!result.ok) {
        throw new Error(`failAwaitingRun failed: ${result.error.code} ${result.error.message}`);
      }
      return result.value;
    });
    logger.info('agentApprovalGate: approval timed out', { runId: input.runId, approvalId });
    return { outcome: 'timeout' };
  }

  // 5b. Rejected: mark the run failed (guarded; handler also fails idempotently).
  if (resolved.status === 'rejected') {
    await step.run(`fail-rejected-${approvalId}`, async () => {
      const result = await failAwaitingRun(
        input.runId,
        { code: 'APPROVAL_REJECTED', approvalId, reviewerId: resolved.reviewerId, comment: resolved.comment },
        resolved.comment ?? 'Approval rejected by reviewer'
      );
      if (!result.ok) {
        throw new Error(`failAwaitingRun failed: ${result.error.code} ${result.error.message}`);
      }
      return result.value;
    });
    logger.info('agentApprovalGate: approval rejected', { runId: input.runId, approvalId });
    return { outcome: 'rejected', reviewerId: resolved.reviewerId, comment: resolved.comment };
  }

  // 5c. Approved: return the decision with approvedActionIds populated so the
  //     executor's autonomy gate recognizes the approved action.
  logger.info('agentApprovalGate: approval granted', { runId: input.runId, approvalId });
  return {
    outcome: 'approved',
    approvedActionIds: [input.actionId],
    reviewerId: resolved.reviewerId,
    comment: resolved.comment,
  };
}
