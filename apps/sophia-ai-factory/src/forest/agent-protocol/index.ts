/**
 * Agent Protocol — barrel export
 * @module forest/agent-protocol
 */

export {
  agentRegistry,
  InMemoryAgentRegistry,
} from './registry';
export {
  checkAgentPermission,
  requiresApproval,
  defaultAgentPermissions,
  AgentRunner,
} from './types';
export type {
  AgentRegistry,
  AgentExecutionContext,
  AgentLogEntry,
  ToolInvocation,
  ToolDefinition,
  AgentCostRecord,
  RollbackPlan,
  AgentProtocol,
  AgentRunnerConfig,
  AgentRunnerEvent,
} from './types';