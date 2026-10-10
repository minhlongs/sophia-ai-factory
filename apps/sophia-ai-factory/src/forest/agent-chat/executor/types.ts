/**
 * @module forest/agent-chat/executor/types
 * Tool executor contracts and formatting helpers.
 */

import type { AgentToolResult } from '../tool-registry';

export type {
  AgentToolDefinition,
  AgentToolResult,
  IToolExecutor,
} from '../tool-registry';
export { AgentToolName } from '../tool-registry';

export function toolOk(content: string | Record<string, unknown> | unknown[]): AgentToolResult {
  return { success: true, content, isInternal: false };
}

export function toolError(message: string): AgentToolResult {
  return { success: false, content: message, error: message, isInternal: false };
}
