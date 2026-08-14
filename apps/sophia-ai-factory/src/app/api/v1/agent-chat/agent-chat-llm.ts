/**
 * LLM call with tool-use support and tool-use loop execution.
 * @module app/api/v1/agent-chat/agent-chat-llm
 */

import { formatStream, openAiStreamToChunks } from '@/forest/agent-chat/stream-formatter';
import { ToolRegistry, SophiaToolExecutor, ToolUseLoop, MAX_TOOL_ROUNDS } from '@/forest/agent-chat/tool-use-loop';
import type { SseEvent } from '@/forest/agent-chat/types';
import { extractToolCallsFromEvents, buildToolResultMessages } from './agent-chat-helpers';

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface LlmCallOptions {
  messages: Array<{ role: string; content: string | Array<unknown> }>;
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
  toolChoice?: string | { type: string };
  userId: string;
  llmRoute: { baseUrl: string; apiKey: string; model: string };
}

export type LlmCallResult = {
  response: Response;
  events: SseEvent[];
  stopReason: string | undefined;
};

/* ── LLM Call ────────────────────────────────────────────────────────────── */

/**
 * Call the LLM provider and return the raw response + parsed events.
 * Supports both OpenAI-compatible and Anthropic-style streaming.
 */
export async function callLlmWithTools(options: LlmCallOptions): Promise<LlmCallResult> {
  const { messages, tools, toolChoice, userId: _userId, llmRoute } = options;

  const requestBody: Record<string, unknown> = {
    model: llmRoute.model,
    messages,
    max_tokens: 4096,
    temperature: 0.7,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = toolChoice ?? 'auto';
  }

  const response = await fetch(`${llmRoute.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llmRoute.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => 'upstream error');
    throw new Error(`LLM upstream error: ${errText}`);
  }

  const chunks = openAiStreamToChunks(response.body);
  const events: SseEvent[] = [];
  for await (const event of formatStream(chunks)) {
    events.push(event);
  }

  const lastContentEvent = events.filter((e) => e.type === 'token').pop();
  const stopReason = lastContentEvent
    ? (lastContentEvent.data as string).match(/"stop_reason"\s*:\s*"([^"]+)"/)?.[1]
    : undefined;

  return { response, events, stopReason };
}

/* ── Tool-Use Loop ───────────────────────────────────────────────────────── */

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
  encoder: TextEncoder,
  emitToClient: (event: SseEvent) => void,
): Promise<SseEvent[]> {
  const allClientEvents: SseEvent[] = [];
  let messages = [...initialMessages];
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    const tools = registry.getOpenAITools();

    let result: LlmCallResult;
    try {
      result = await callLlmWithTools({
        messages,
        tools,
        userId,
        llmRoute,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LLM call failed';
      emitToClient({ type: 'error', message: msg });
      allClientEvents.push({ type: 'error', message: msg });
      break;
    }

    for (const event of result.events) {
      if (event.type === 'token' || event.type === 'reasoning') {
        emitToClient(event);
        allClientEvents.push(event);
      }
    }

    if (!result.stopReason || result.stopReason !== 'tool_use') {
      emitToClient({ type: 'done' });
      allClientEvents.push({ type: 'done' });
      break;
    }

    const toolCalls = extractToolCallsFromEvents(result.events);
    if (toolCalls.length === 0) {
      emitToClient({ type: 'done' });
      allClientEvents.push({ type: 'done' });
      break;
    }

    const loop = new ToolUseLoop(registry, executor);
    const results = await loop.executeToolCalls(toolCalls, userId);

    for (const resultEvent of results) {
      emitToClient(resultEvent);
      allClientEvents.push(resultEvent);
    }

    const toolResultMessages = buildToolResultMessages(toolCalls, results);
    messages = [...messages, ...toolResultMessages];

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  if (round >= MAX_TOOL_ROUNDS) {
    emitToClient({ type: 'done' });
    allClientEvents.push({ type: 'done' });
  }

  return allClientEvents;
}
