/**
 * LLM call with tool-use support and tool-use loop execution.
 * @module app/api/v1/agent-chat/agent-chat-llm
 */

import { ToolRegistry, SophiaToolExecutor, ToolUseLoop, MAX_TOOL_ROUNDS } from '@/forest/agent-chat/tool-use-loop';
import type { SseEvent } from '@/forest/agent-chat/types';
import { extractToolCallsFromEvents, buildToolResultMessages } from './agent-chat-helpers';
import {
  callLlmWithTools,
  type LlmCallOptions,
  type LlmCallResult,
} from './agent-chat-llm-caller';

export { callLlmWithTools, type LlmCallOptions, type LlmCallResult };

function emitAndRecordEvents(
  events: SseEvent[],
  emitToClient: (event: SseEvent) => void,
  allClientEvents: SseEvent[],
  filterTokensOnly: boolean,
): void {
  for (const event of events) {
    if (!filterTokensOnly || event.type === 'token' || event.type === 'reasoning') {
      emitToClient(event);
      allClientEvents.push(event);
    }
  }
}

/**
 * Run the tool-use loop: call LLM -> detect tool_use -> execute -> feed back -> repeat.
 * Returns the final stream events to send to the client.
 */
export async function runToolUseLoop(
  initialMessages: Array<{ role: string; content: string | Array<unknown> }>,
  userId: string,
  llmRoute: { baseUrl: string; apiKey: string; model: string },
  registry: ToolRegistry,
  executor: SophiaToolExecutor,
  _encoder: TextEncoder,
  emitToClient: (event: SseEvent) => void,
): Promise<SseEvent[]> {
  const allClientEvents: SseEvent[] = [];
  let messages = [...initialMessages];
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    let result: LlmCallResult;
    try {
      result = await callLlmWithTools({
        messages,
        tools: registry.getOpenAITools(),
        userId,
        llmRoute,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LLM call failed';
      emitAndRecordEvents([{ type: 'error', message: msg }], emitToClient, allClientEvents, false);
      break;
    }

    emitAndRecordEvents(result.events, emitToClient, allClientEvents, true);

    const toolCalls = result.stopReason === 'tool_use'
      ? extractToolCallsFromEvents(result.events)
      : [];
    if (toolCalls.length === 0) {
      emitAndRecordEvents([{ type: 'done' }], emitToClient, allClientEvents, false);
      break;
    }

    const loop = new ToolUseLoop(registry, executor);
    const results = await loop.executeToolCalls(toolCalls, userId);
    emitAndRecordEvents(results, emitToClient, allClientEvents, false);

    messages = [...messages, ...buildToolResultMessages(toolCalls, results)];
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  if (round >= MAX_TOOL_ROUNDS) {
    emitAndRecordEvents([{ type: 'done' }], emitToClient, allClientEvents, false);
  }

  return allClientEvents;
}
