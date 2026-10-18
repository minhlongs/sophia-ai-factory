/**
 * Single and batch tool-call execution helpers for ToolUseLoop.
 * @module forest/agent-chat/loop/tool-call-runner
 */

import { createLogger } from '@/seed/utils/logger-utility';
import type { SophiaToolExecutor } from '../tool-executor';
import type { SseEvent } from '../types';
import { TOOL_ROUND_DELAY_MS, type ParsedToolCall } from './types';

const logger = createLogger('tool-use-loop');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a single tool call and return the result event.
 */
export async function executeSingleToolCall(
  executor: SophiaToolExecutor,
  call: ParsedToolCall,
  userId: string,
): Promise<SseEvent & { type: 'tool_result' }> {
  logger.debug('Executing tool call', { tool: call.name, id: call.id, userId });

  try {
    const result = await executor.execute(call.name, call.args, userId);

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
    logger.error('Tool execution threw', { tool: call.name, error: message });
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
 */
export async function executeBatchToolCalls(
  executor: SophiaToolExecutor,
  calls: ParsedToolCall[],
  userId: string,
  emitToolEvents: boolean,
): Promise<SseEvent[]> {
  const results: SseEvent[] = [];

  for (const call of calls) {
    if (emitToolEvents) {
      results.push({
        type: 'tool_call',
        data: { id: call.id, name: call.name, args: call.args },
      });
    }

    const result = await executeSingleToolCall(executor, call, userId);
    results.push(result);

    if (calls.length > 1) {
      await sleep(TOOL_ROUND_DELAY_MS);
    }
  }

  return results;
}
