/**
 * @module forest/agent-chat/tool-use-loop
 *
 * Agent Tool-Use Loop — detects tool_use blocks from LLM, executes tools,
 * feeds results back, and loops until the model returns endTurn.
 *
 * Ported from Palmier Pro's AgentService.runLoop() pattern, adapted for
 * Sophia's SSE streaming + OpenAI-compatible provider API.
 *
 * Import direction: forest → seed, tree (ONE-WAY).
 */

import { createLogger } from '@/seed/utils/logger-utility';
import { SophiaToolExecutor } from './tool-executor';
import { ToolRegistry, AgentToolName } from './tool-registry';
import type { SseEvent } from './types';

export { SophiaToolExecutor } from './tool-executor';
export { ToolRegistry, AgentToolName } from './tool-registry';

const logger = createLogger('tool-use-loop');

// ── Configuration ──────────────────────────────────────────────────────────────

/** Maximum tool-use rounds per chat turn (prevents infinite loops) */
export const MAX_TOOL_ROUNDS = 8;

/** Delay between tool rounds (ms) — lets the model "breathe" */
export const TOOL_ROUND_DELAY_MS = 200;

// ── Tool Call Parsing ──────────────────────────────────────────────────────────

/**
 * Parse tool_use blocks from an Anthropic-style SSE event payload.
 *
 * Anthropic returns: { type: "content_block_start", content_block: { type: "tool_use", id, name, input } }
 * or: { type: "content_block_delta", delta: { type: "tool_use", partial_json } }
 *
 * OpenAI returns: { choices: [{ delta: { tool_calls: [{ id, function: { name, arguments } }] }] }
 *
 * This module handles Anthropic-style events (Sophia's primary format via stream-formatter).
 */
export interface ParsedToolCall {
  id: string;
  name: AgentToolName;
  args: Record<string, unknown>;
}

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
      // Detect tool_use JSON in streaming content
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
  // Check if any events contain tool_call type
  return events.some((e) => e.type === 'tool_call');
}

// ── Type Guards ────────────────────────────────────────────────────────────────

function isToolResult(event: SseEvent): event is SseEvent & { type: 'tool_result' } {
  return event.type === 'tool_result';
}

// ── Tool-Use Loop ──────────────────────────────────────────────────────────────

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

/**
 * Run the tool-use loop:
 * 1. Send messages to LLM with tools available
 * 2. Check if response contains tool_use
 * 3. If yes: execute tools, append results, go to 1
 * 4. If no: return final response
 *
 * This is a simplified version that works with Sophia's existing streaming infrastructure.
 * The actual LLM calls happen in the route; this module handles the loop logic.
 */
export class ToolUseLoop {
  private registry: ToolRegistry;
  private executor: SophiaToolExecutor;
  private options: Required<ToolUseLoopOptions>;
  private logger = logger;

  constructor(registry: ToolRegistry, executor: SophiaToolExecutor, options: ToolUseLoopOptions = {}) {
    this.registry = registry;
    this.executor = executor;
    this.options = {
      maxRounds: options.maxRounds ?? MAX_TOOL_ROUNDS,
      roundDelayMs: options.roundDelayMs ?? TOOL_ROUND_DELAY_MS,
      emitToolEvents: options.emitToolEvents ?? true,
    };
  }

  /**
   * Execute a single tool call and return the result event.
   */
  async executeToolCall(
    call: ParsedToolCall,
    userId: string,
  ): Promise<SseEvent & { type: 'tool_result' }> {
    this.logger.debug('Executing tool call', { tool: call.name, id: call.id, userId });

    try {
      const result = await this.executor.execute(call.name, call.args, userId);

      if (this.options.emitToolEvents) {
        // Emit tool_call event first
        const toolCallEvent: SseEvent = {
          type: 'tool_call',
          data: { id: call.id, name: call.name, args: call.args },
        };
      }

      const contentStr = typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);

      return {
        type: 'tool_result',
        data: {
          id: call.id,
          name: call.name,
          success: result.success,
          content: contentStr,
          error: result.error,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tool execution failed';
      this.logger.error('Tool execution threw', { tool: call.name, error: message });
      return {
        type: 'tool_result',
        data: {
          id: call.id,
          name: call.name,
          success: false,
          content: message,
          error: message,
        },
      };
    }
  }

  /**
   * Execute all tool calls from a single LLM response round.
   * Returns tool_result events for each call.
   */
  async executeToolCalls(
    calls: ParsedToolCall[],
    userId: string,
  ): Promise<SseEvent[]> {
    const results: SseEvent[] = [];

    for (const call of calls) {
      // Emit tool_call event
      if (this.options.emitToolEvents) {
        results.push({
          type: 'tool_call',
          data: { id: call.id, name: call.name, args: call.args },
        });
      }

      // Execute and get result
      const result = await this.executeToolCall(call, userId);
      results.push(result);

      // Small delay between tool executions
      if (calls.length > 1) {
        await this.sleep(TOOL_ROUND_DELAY_MS);
      }
    }

    return results;
  }

  /**
   * Build tool results in Anthropic Messages API format for feeding back to the LLM.
   * Each result becomes a `tool_result` content block.
   */
  buildToolResultMessages(
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

  /**
   * Get the tools in OpenAI-compatible format for the LLM request.
   */
  getOpenAITools() {
    return this.registry.getOpenAITools();
  }

  /**
   * Get the tools in Anthropic format for the LLM request.
   */
  getAnthropicTools() {
    return this.registry.getAnthropicTools();
  }

  /** Get total description tokens for context budgeting */
  getToolDescriptionTokens(): number {
    return this.registry.getTotalDescriptionTokens();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
