/**
 * Single-round LLM provider caller with tool-use support.
 * @module app/api/v1/agent-chat/agent-chat-llm-caller
 */

import { formatStream, openAiStreamToChunks } from '@/forest/agent-chat/stream-formatter';
import type { SseEvent } from '@/forest/agent-chat/types';

export interface LlmCallOptions {
  messages: Array<{ role: string; content: string | Array<unknown> }>;
  tools?: Array<{
    type: string;
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  toolChoice?: string | { type: string };
  userId: string;
  llmRoute: { baseUrl: string; apiKey: string; model: string };
}

export type LlmCallResult = {
  response: Response;
  events: SseEvent[];
  stopReason: string | undefined;
};

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
