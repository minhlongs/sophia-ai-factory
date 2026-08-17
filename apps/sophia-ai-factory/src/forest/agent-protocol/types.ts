/**
 * Agent Protocol — Shared Contract for Sophia 2027 Agents
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Defines the universal interface that ALL Sophia agents implement.
 * Used by forest agents, orchestrated by land workflows.
 *
 * @module forest/agent-protocol
 */

import type {
  AgentDefinition,
  AgentContext,
  AgentDecision,
  AgentAction,
  AgentResult,
  AgentApproval,
  AgentRun,
  AgentPermission,
  AutonomyLevel,
  CreativeIdentity,
  CreativeMemory,
  ModelPolicy,
} from '@/seed/types/creative-domain';

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

export type AgentRunPhase = 'planning' | 'executing' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled' | 'retrying';

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
// Protocol Interface (what every agent must implement)
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

// ---------------------------------------------------------------------------
// Runner (orchestrates an agent through its lifecycle)
// ---------------------------------------------------------------------------

export type AgentRunnerEvent =
  | { type: 'phase_change'; phase: AgentRunPhase }
  | { type: 'action_start'; actionIndex: number; action: AgentAction }
  | { type: 'action_complete'; actionIndex: number; result: AgentResult }
  | { type: 'approval_required'; approval: AgentApproval }
  | { type: 'log'; entry: AgentLogEntry }
  | { type: 'error'; error: { code: string; message: string } };

export interface AgentRunnerConfig {
  autonomyLevel: AutonomyLevel;
  maxRetries: number;
  timeoutMs: number;
  costLimitCents?: number;
  onEvent?: (event: AgentRunnerEvent) => void;
}

export class AgentRunner {
  private run: AgentRun;
  private config: AgentRunnerConfig;
  private context: AgentContext;
  private agent: AgentProtocol;
  private logs: AgentLogEntry[] = [];
  private retryCount = 0;
  private _onEvent?: (event: AgentRunnerEvent) => void;
  totalCostCents = 0;
  totalTokens = 0;

  constructor(agent: AgentProtocol, context: AgentContext, config: AgentRunnerConfig) {
    this.agent = agent;
    this.context = context;
    this.config = config;
    this.run = {
      id: '',
      agentId: agent.definition.id,
      workspaceId: context.workspaceId,
      missionId: context.missionId,
      input: {},
      actions: [],
      status: 'queued',
      autonomyLevel: config.autonomyLevel,
    };
  }

  getContext(): AgentContext {
    return this.context;
  }

  getRunId(): string {
    return this.run.id;
  }

  /** Generate run ID */
  private generateRunId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return 'run_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** Main entry: execute mission with this agent */
  async execute(input: Record<string, unknown>): Promise<AgentRun> {
    this.run.id = this.generateRunId();
    this.run.input = input;
    this.run.status = 'running';
    this.run.startedAt = Date.now();
    this.emit({ type: 'phase_change', phase: 'executing' });

    try {
      // 1. Plan
      this.emit({ type: 'log', entry: { timestamp: Date.now(), level: 'info', message: 'Planning phase' } });
      const decision = await this.agent.plan(input, this.context);
      this.run.decision = decision;

      // 2. Check approval requirements
      if (decision.requiresHumanApproval || this.config.autonomyLevel < 2) {
        this.run.status = 'awaiting_approval';
        this.emit({ type: 'phase_change', phase: 'awaiting_approval' });
        return this.run;
      }

      // 3. Execute
      this.run.actions = this.buildActions(decision);
      const result = await this.agent.execute(decision, this.context);
      this.run.result = result;

      if (result.success) {
        this.run.status = 'completed';
        this.emit({ type: 'phase_change', phase: 'completed' });
      } else {
        this.run.status = 'failed';
        this.run.error = result.error;
        this.emit({ type: 'phase_change', phase: 'failed' });
      }

      this.run.finishedAt = Date.now();
      return this.run;
    } catch (err) {
      this.run.status = 'failed';
      this.run.error = { code: 'RUNTIME_ERROR', message: err instanceof Error ? err.message : 'Unknown error' };
      this.run.finishedAt = Date.now();
      this.emit({ type: 'error', error: this.run.error });
      return this.run;
    }
  }

  private buildActions(decision: AgentDecision): AgentAction[] {
    // Derive actions from decision type
    return [
      {
        type: decision.type,
        tool: decision.type,
        parameters: decision.type === 'plan' ? {} : {},
        estimatedCostCents: 0,
        approvalRequired: decision.requiresHumanApproval,
      },
    ];
  }

  private emit(event: AgentRunnerEvent): void {
    this.config.onEvent?.(event);
  }
}

// ---------------------------------------------------------------------------
// Policy enforcement
// ---------------------------------------------------------------------------

export function checkAgentPermission(
  agent: AgentDefinition,
  action: AgentAction,
  autonomyLevel: AutonomyLevel,
): { allowed: boolean; reason?: string } {
  const perm = agent.permissions.find((p) => p.tool === action.tool || p.tool === '*');
  if (!perm) return { allowed: false, reason: `Tool ${action.tool} not permitted for ${agent.name}` };

  if (autonomyLevel < 2 && perm.requiresApproval) {
    return { allowed: false, reason: `Requires human approval (autonomy level ${autonomyLevel})` };
  }

  if (perm.maxCostCents !== undefined && (action.estimatedCostCents ?? 0) > perm.maxCostCents) {
    return { allowed: false, reason: `Cost exceeds limit: ${action.estimatedCostCents} > ${perm.maxCostCents} cents` };
  }

  return { allowed: true };
}

export function requiresApproval(action: AgentAction, autonomyLevel: AutonomyLevel): boolean {
  return autonomyLevel < 2 || action.approvalRequired;
}

// ---------------------------------------------------------------------------
// Factory helpers (build common agent definitions)
// ---------------------------------------------------------------------------

export function defaultAgentPermissions(tools: string[]): AgentPermission[] {
  return tools.map((tool) => ({
    tool,
    scopes: [tool],
    requiresApproval: true,
    maxCostCents: 1000,
  }));
}