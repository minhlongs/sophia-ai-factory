/**
 * Agent Approval Gate Types
 * Layer: FOREST (Infrastructure Orchestration)
 */

import type {
  AgentApprovalRequestedData,
  AgentApprovalResolvedData,
} from '@/seed/inngest/agent-event-types';

export type RequestedData = AgentApprovalRequestedData['data'];
export type ResolvedData = AgentApprovalResolvedData['data'];

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
