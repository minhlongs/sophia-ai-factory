/**
 * SSE helpers, message builders, and tool-call extraction for agent-chat.
 * @module app/api/v1/agent-chat/agent-chat-helpers
 */

import { serializeSseEvent } from '@/forest/agent-chat/stream-formatter';
import { type ParsedToolCall } from '@/forest/agent-chat/tool-use-loop';
import type { SseEvent } from '@/forest/agent-chat/types';

/** Emit a single SSE event string */
export function emit(event: SseEvent): string {
  return serializeSseEvent(event);
}

/**
 * Build the full message array when consolidation has occurred.
 * Keeps system prompt + optional summary + last N recent messages.
 */
export function buildConsolidatedMessages(
  systemPrompt: string,
  originalMessages: { role: string; content: string }[],
  keepRecent: number,
  summaryContent: string,
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const conversation = originalMessages.filter((m) => m.role !== 'system');
  const recent = conversation.slice(-keepRecent);
  const result: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];
  if (summaryContent) {
    result.push({ role: 'system', content: summaryContent });
  }
  for (const m of recent) {
    result.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }
  return result;
}

/**
 * Extract tool_calls from OpenAI-compatible streaming events.
 * Parses delta.tool_calls from the stream.
 */
export function extractToolCallsFromEvents(events: SseEvent[]): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  const pendingCalls = new Map<number, { id?: string; name?: string; args: string }>();

  for (const event of events) {
    if (event.type !== 'token') continue;
    const data = event.data as string;

    const toolCallMatch = data.match(/"tool_calls"\s*:\s*\[/);
    if (!toolCallMatch) continue;

    try {
      const fullMatch = data.match(/"choices"\s*:\s*\[\{.*?"delta"\s*:\s*\{.*?"tool_calls"\s*:\s*(\[.*?\])/s);
      if (fullMatch) {
        const toolCallsArray = JSON.parse(fullMatch[1]) as Array<{
          index: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;

        for (const tc of toolCallsArray) {
          const existing = pendingCalls.get(tc.index) ?? { args: '' };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
          pendingCalls.set(tc.index, existing);
        }
      }
    } catch {
      // Partial JSON — accumulate and parse later
    }
  }

  for (const [, pending] of pendingCalls) {
    if (pending.id && pending.name) {
      calls.push({
        id: pending.id,
        name: pending.name as ParsedToolCall['name'],
        args: pending.args ? JSON.parse(pending.args) : {},
      });
    }
  }

  return calls;
}

/**
 * Build tool result messages in OpenAI-compatible format for feeding back to LLM.
 */
export function buildToolResultMessages(
  calls: ParsedToolCall[],
  results: SseEvent[],
): Array<
  | { role: 'assistant'; content: string; tool_calls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> }
  | { role: 'tool'; tool_call_id: string; content: string }
> {
  const resultMap = new Map<string, SseEvent & { type: 'tool_result' }>();
  for (const r of results) {
    if (r.type === 'tool_result') {
      resultMap.set(r.data.id, r);
    }
  }

  const assistantMessage: { role: 'assistant'; content: string; tool_calls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> } = {
    role: 'assistant',
    content: '',
    tool_calls: calls.map((c) => ({
      id: c.id,
      type: 'function',
      function: { name: c.name, arguments: JSON.stringify(c.args) },
    })),
  };

  const toolResults = calls.map((c) => {
    const result = resultMap.get(c.id);
    const data = result?.data as { output?: string; success?: boolean; error?: string } | undefined;
    const content = data?.output ?? data?.error ?? 'Unknown error';

    return {
      role: 'tool' as const,
      tool_call_id: c.id,
      content: data?.success ?? false ? content : `Error: ${data?.error ?? 'Unknown'}`,
    };
  });

  return [assistantMessage, ...toolResults];
}
