/**
 * Types and interfaces for Agent Tool-Use Loop
 * @module forest/agent-chat/loop/types
 */

import { AgentToolName } from '../tool-registry';
import type { SseEvent } from '../types';

/** Maximum tool-use rounds per chat turn (prevents infinite loops) */
export const MAX_TOOL_ROUNDS = 8;

/** Delay between tool rounds (ms) — lets the model "breathe" */
export const TOOL_ROUND_DELAY_MS = 200;

export interface ParsedToolCall {
  id: string;
  name: AgentToolName;
  args: Record<string, unknown>;
}

export interface ToolUseLoopOptions {
  /** Maximum rounds before forcing endTurn */
  maxRounds?: number;
  /** Delay between rounds (ms) */
  roundDelayMs?: number;
  /** Emit tool_call events to client */
  emitToolEvents?: boolean;
}

export interface ToolUseLoopResult {
  /** Final events to stream to client (includes tool_call + tool_result + final response) */
  events: SseEvent[];
  /** Whether the loop completed normally (vs hit max rounds) */
  completed: boolean;
  /** Total tool calls executed */
  toolCallsExecuted: number;
}
