/**
 * Canonical agent/runtime contracts — 7 interfaces.
 *
 * CONTRACTS ONLY: method signatures + return types, no implementation.
 * Entities are referenced from `@/seed/types/creative-domain` — never redefined.
 *
 * @module seed/types/creative-economy/interfaces-agents
 */

import type {
  AgentAction,
  AgentContext,
  AgentDefinition,
  AgentRun,
  AgentResult,
  ProvenanceAction,
  ProvenanceRecord,
} from '@/seed/types/creative-domain'
import type { Result } from '@/seed/types/result'
import type {
  ApprovalRequestId,
  ProvenanceRecordId,
  AgentRunId,
} from './ids'

export type {
  RouteRequest,
  IModelRouter,
  IProviderAdapter,
  MissionTransition,
  IMissionOrchestrator,
} from './interfaces-agents-routing'

// ─── IAgentRegistry ──────────────────────────────────────────────────────────

export interface IAgentRegistry {
  /** Register a new agent definition. */
  register(definition: Omit<AgentDefinition, 'id'>): Promise<Result<string, Error>>
  /** Fetch by id. */
  get(agentId: string): Promise<Result<AgentDefinition, Error>>
  /** List all registered agents, optionally filtered by capability. */
  list(capability?: string): Promise<Result<AgentDefinition[], Error>>
  /** Update an existing definition (partial). */
  update(agentId: string, patch: Partial<AgentDefinition>): Promise<Result<boolean, Error>>
  /** Check whether a tool is permitted for an agent under a given autonomy level. */
  isPermitted(agentId: string, tool: string, autonomyLevel: number): Promise<Result<boolean, Error>>
}

// ─── IAgentExecutor ──────────────────────────────────────────────────────────

export interface IAgentExecutor {
  /** Queue an agent run. */
  run(agentId: string, context: AgentContext, input: Record<string, unknown>): Promise<Result<AgentRunId, Error>>
  /** Poll the current status of a run. */
  status(runId: AgentRunId): Promise<Result<AgentRun, Error>>
  /** Cancel a queued/running run. */
  cancel(runId: AgentRunId, reason?: string): Promise<Result<boolean, Error>>
  /** Wait for completion or terminal failure (bounded by timeoutMs). */
  await(runId: AgentRunId, timeoutMs?: number): Promise<Result<AgentRun, Error>>
  /** Execute a single action synchronously (for low-latency approval checks). */
  executeAction(action: AgentAction, context: AgentContext): Promise<Result<AgentResult, Error>>
}

// ─── IApprovalGateway ────────────────────────────────────────────────────────

export interface ApprovalRequest {
  id: ApprovalRequestId
  agentRunId: AgentRunId
  action: AgentAction
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewComment?: string
  reviewedAt?: number
}

export interface IApprovalGateway {
  /** Submit an action for human approval. */
  request(approval: Omit<ApprovalRequest, 'id' | 'status' | 'reviewedBy' | 'reviewComment' | 'reviewedAt'>): Promise<Result<ApprovalRequestId, Error>>
  /** Fetch a pending approval request by id. */
  get(id: ApprovalRequestId): Promise<Result<ApprovalRequest, Error>>
  /** Approve or reject. */
  decide(id: ApprovalRequestId, decision: 'approved' | 'rejected', reviewedBy: string, comment?: string): Promise<Result<boolean, Error>>
  /** List pending approvals for a workspace. */
  pending(workspaceId: string): Promise<Result<ApprovalRequest[], Error>>
  /** Bulk-decide by action type (used by autonomy-level pre-approval lists). */
  bulkDecide(workspaceId: string, actionType: string, decision: 'approved' | 'rejected', reviewedBy: string): Promise<Result<number, Error>>
}

// ─── IProvenanceLedger ───────────────────────────────────────────────────────

export interface ProvenanceQuery {
  workspaceId?: string
  assetId?: string
  agentRunId?: string
  action?: ProvenanceAction
  actorType?: 'human' | 'agent' | 'system'
  from?: number
  to?: number
  limit?: number
}

export interface IProvenanceLedger {
  append(record: Omit<ProvenanceRecord, 'id' | 'createdAt'>): Promise<Result<ProvenanceRecordId, Error>>
  get(id: ProvenanceRecordId): Promise<Result<ProvenanceRecord, Error>>
  byAsset(assetId: string): Promise<Result<ProvenanceRecord[], Error>>
  byRun(agentRunId: AgentRunId): Promise<Result<ProvenanceRecord[], Error>>
  query(query: ProvenanceQuery): Promise<Result<ProvenanceRecord[], Error>>
  /** Verify that an asset has at least one record for a required action. */
  hasAction(assetId: string, action: ProvenanceAction): Promise<Result<boolean, Error>>
}
