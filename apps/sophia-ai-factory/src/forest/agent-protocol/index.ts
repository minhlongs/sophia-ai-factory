/**
 * Agent Protocol — barrel export
 * @module forest/agent-protocol
 *
 * @deprecated 2026-08-16 — barrel for the deprecated forest agent protocol.
 * Use `@/tree/agent-protocol` instead. Retained for backward compatibility
 * with the Inngest agent-mission-executor integration.
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