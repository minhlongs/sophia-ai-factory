/**
 * Agent Tool-Use Loop Runner
 * @module forest/agent-chat/loop/loop-runner
 */

import { SophiaToolExecutor } from '../tool-executor';
import { ToolRegistry } from '../tool-registry';
import type { SseEvent } from '../types';
import {
  MAX_TOOL_ROUNDS,
  TOOL_ROUND_DELAY_MS,
  type ParsedToolCall,
  type ToolUseLoopOptions,
} from './types';
import { buildToolResultMessages as buildToolMessagesHelper } from './step-evaluator';
import { executeSingleToolCall, executeBatchToolCalls } from './tool-call-runner';

/**
 * Run the tool-use loop:
 * 1. Send messages to LLM with tools available
 * 2. Check if response contains tool_use
 * 3. If yes: execute tools, append results, go to 1
 * 4. If no: return final response
 */
export class ToolUseLoop {
  private registry: ToolRegistry;
  private executor: SophiaToolExecutor;
  private options: Required<ToolUseLoopOptions>;

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
    return executeSingleToolCall(this.executor, call, userId);
  }

  /**
   * Execute all tool calls from a single LLM response round.
   * Returns tool_result events for each call.
   */
  async executeToolCalls(
    calls: ParsedToolCall[],
    userId: string,
  ): Promise<SseEvent[]> {
    return executeBatchToolCalls(this.executor, calls, userId, this.options.emitToolEvents);
  }

  /**
   * Build tool results in Anthropic Messages API format for feeding back to the LLM.
   */
  buildToolResultMessages(
    calls: ParsedToolCall[],
    results: SseEvent[],
  ): Array<{ role: 'user'; content: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> }> {
    return buildToolMessagesHelper(calls, results);
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
}
