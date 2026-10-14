/**
 * Agent Runner Execution Engine
 * Layer: forest/agent-protocol/types
 */

import type {
  AgentAction,
  AgentApproval,
  AgentContext,
  AgentDecision,
  AgentResult,
  AgentRun,
  AutonomyLevel,
} from '@/seed/types/creative-domain';
import type { AgentLogEntry, AgentProtocol, AgentRunPhase } from './context';

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

  private generateRunId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return 'run_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  async execute(input: Record<string, unknown>): Promise<AgentRun> {
    this.run.id = this.generateRunId();
    this.run.input = input;
    this.run.status = 'running';
    this.run.startedAt = Date.now();
    this.emit({ type: 'phase_change', phase: 'executing' });

    try {
      this.emit({ type: 'log', entry: { timestamp: Date.now(), level: 'info', message: 'Planning phase' } });
      const decision = await this.agent.plan(input, this.context);
      this.run.decision = decision;

      if (decision.requiresHumanApproval || this.config.autonomyLevel < 2) {
        this.run.status = 'awaiting_approval';
        this.emit({ type: 'phase_change', phase: 'awaiting_approval' });
        return this.run;
      }

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
