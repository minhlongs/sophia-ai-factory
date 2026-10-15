/**
 * Agent Protocol Context, Logging & Tool Invocation Types
 * Layer: forest/agent-protocol/types
 */

import type { AgentDefinition, AgentRun, AgentContext, AgentDecision, AgentResult, AgentApproval } from '@/seed/types/creative-domain';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface AgentRegistry {
  agents: Map<string, AgentProtocol>;
  register(agent: AgentProtocol): void;
  get(id: string): AgentProtocol | undefined;
  listByCapability(capability: string): AgentDefinition[];
  has(id: string): boolean;
  readonly definitions: Map<string, AgentDefinition>;
}

// ---------------------------------------------------------------------------
// Execution Lifecycle
// ---------------------------------------------------------------------------

export type AgentRunPhase =
  | 'planning'
  | 'executing'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying';

export interface AgentExecutionContext {
  run: AgentRun;
  phase: AgentRunPhase;
  currentActionIndex: number;
  logs: AgentLogEntry[];
  startedAt: number;
  updatedAt: number;
}

export interface AgentLogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool Invocation
// ---------------------------------------------------------------------------

export interface ToolInvocation {
  id: string;
  agentRunId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs: number;
  costCents: number;
  tokensUsed?: number;
  createdAt: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiredPermissions: string[];
  estimatedCostCents: number;
  idempotent: boolean;
}

// ---------------------------------------------------------------------------
// Cost Tracking
// ---------------------------------------------------------------------------

export interface AgentCostRecord {
  agentRunId: string;
  provider?: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
  actualCostCents?: number;
  durationMs: number;
  assetCostCents: number;
  jobCostCents: number;
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

export interface RollbackPlan {
  agentRunId: string;
  actions: Array<{
    actionId: string;
    undoType: string;
    undoParameters: Record<string, unknown>;
    dependsOn?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Protocol Interface
// ---------------------------------------------------------------------------

export interface AgentProtocol {
  /** Static metadata */
  readonly definition: AgentDefinition;

  /** Initialize context from mission/workspace */
  initializeContext(context: Omit<AgentContext, 'memory' | 'correlationId'>): Promise<AgentContext>;

  /** Plan: decide what actions to take */
  plan(input: Record<string, unknown>, context: AgentContext): Promise<AgentDecision>;

  /** Execute: run actions sequentially with approval gates */
  execute(decision: AgentDecision, context: AgentContext): Promise<AgentResult>;

  /** Handle human approval/rejection */
  handleApproval?(approval: AgentApproval, context: AgentContext): Promise<AgentResult>;

  /** Rollback: undo actions from a failed run */
  rollback?(runId: string, context: AgentContext): Promise<void>;
}
