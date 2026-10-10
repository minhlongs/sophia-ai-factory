/**
 * Tool call parsing and step evaluation helpers
 * @module forest/agent-chat/loop/step-evaluator
 */

import { AgentToolName } from '../tool-registry';
import type { SseEvent } from '../types';
import type { ParsedToolCall } from './types';

/**
 * Parse tool_use content blocks from Anthropic SSE events.
 * Extracts tool calls from content_block_start + content_block_delta events.
 */
export function parseToolCallsFromEvents(events: SseEvent[]): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  const pendingBlocks: Map<string, { name: string; input: Record<string, unknown> }> = new Map();

  for (const event of events) {
    if (event.type === 'tool_call') {
      const tc = event.data as { id: string; name: string; args: Record<string, unknown> };
      calls.push({
        id: tc.id,
        name: AgentToolName[tc.name as keyof typeof AgentToolName] ?? AgentToolName.GetCampaigns,
        args: tc.args,
      });
    }

    // Also parse from raw Anthropic content_block events if present in token stream
    if (event.type === 'token' && typeof event.data === 'string') {
      const toolMatch = event.data.match(/"type"\s*:\s*"tool_use"/);
      if (toolMatch) {
        try {
          const parsed = JSON.parse(event.data) as { id?: string; name?: string; input?: Record<string, unknown> };
          if (parsed.id && parsed.name) {
            pendingBlocks.set(parsed.id, { name: parsed.name, input: parsed.input ?? {} });
          }
        } catch {
          // Partial JSON — will be completed in subsequent chunks
        }
      }
    }
  }

  // Finalize any pending blocks
  for (const [id, block] of pendingBlocks) {
    const toolName = AgentToolName[block.name as keyof typeof AgentToolName];
    if (toolName) {
      calls.push({ id, name: toolName, args: block.input });
    }
  }

  return calls;
}

/**
 * Detect if the LLM response indicates it wants to use tools.
 * Checks for tool_use stop reason or tool_calls in the response.
 */
export function hasToolUse(stopReason: string | undefined, events: SseEvent[]): boolean {
  if (stopReason === 'tool_use' || stopReason === 'tool_calls') return true;
  return events.some((e) => e.type === 'tool_call');
}

/**
 * Type guard for tool_result events
 */
export function isToolResult(event: SseEvent): event is SseEvent & { type: 'tool_result' } {
  return event.type === 'tool_result';
}

/**
 * Build tool results in Anthropic Messages API format for feeding back to the LLM.
 * Each result becomes a `tool_result` content block.
 */
export function buildToolResultMessages(
  calls: ParsedToolCall[],
  results: SseEvent[],
): Array<{ role: 'user'; content: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> }> {
  const messages: Array<{ role: 'user'; content: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> }> = [];

  // Group results by call
  const resultMap = new Map<string, SseEvent>();
  for (const r of results) {
    if (r.type === 'tool_result') {
      resultMap.set(r.data.id, r);
    }
  }

  // Build a single user message with all tool results
  const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];
  for (const call of calls) {
    const result = resultMap.get(call.id);
    if (result && isToolResult(result)) {
      const content = typeof result.data.content === 'string'
        ? result.data.content
        : JSON.stringify(result.data.content);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: result.data.success
          ? content
          : `Error: ${result.data.error ?? 'Unknown error'}`,
      });
    }
  }

  if (toolResults.length > 0) {
    messages.push({ role: 'user', content: toolResults });
  }

  return messages;
}
