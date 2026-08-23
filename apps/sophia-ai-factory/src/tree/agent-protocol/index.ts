/**
 * Agent Protocol — barrel export
 * @module tree/agent-protocol
 */

export {
  executeAgent,
} from './agent-executor';
export type {
  ExecutorErrorCode,
  ExecutorError,
  AgentExecutionResult,
} from './agent-executor';
export {
  agentDefinitionRegistry,
  InMemoryAgentDefinitionRegistry,
  type AgentDefinitionRegistry,
} from './agent-registry';