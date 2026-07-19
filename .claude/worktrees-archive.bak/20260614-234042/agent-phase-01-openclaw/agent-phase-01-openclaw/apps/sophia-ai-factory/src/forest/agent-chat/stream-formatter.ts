/**
 * Agent Chat — Stream Formatter
 *
 * Consumes an async iterable of text chunks from upstream LLM providers.
 * Splits <think>...</think> blocks into 'reasoning' SSE events.
 * Remaining content emits as 'token' SSE events.
 * Handles chunk-boundary splits via a 64-char lookahead buffer.
 *
 * @module lib/agent-chat/stream-formatter
 */

import type { SseEvent } from './types';

/** Max chars to buffer when looking for tag boundary */
const TAG_LOOKAHEAD = 64;

type ParseState = 'content' | 'reasoning' | 'tag_open' | 'tag_close';

/**
 * Format an upstream text stream into typed SseEvent objects.
 * Yields events in order; caller serialises to SSE wire format.
 */
export async function* formatStream(
  upstream: AsyncIterable<string>,
): AsyncGenerator<SseEvent> {
  let state: ParseState = 'content';
  let buffer = '';

  for await (const chunk of upstream) {
    buffer += chunk;

    // Flush buffer into events
    while (buffer.length > 0) {
      if (state === 'content') {
        // Look for <think> opening
        const openIdx = buffer.indexOf('<think>');
        if (openIdx === -1) {
          // No tag found — safe to flush all but last 64 chars (tag boundary guard)
          const safeLen = Math.max(0, buffer.length - TAG_LOOKAHEAD);
          if (safeLen > 0) {
            yield { type: 'token', data: buffer.slice(0, safeLen) };
            buffer = buffer.slice(safeLen);
          }
          break;
        }
        // Emit content before tag
        if (openIdx > 0) {
          yield { type: 'token', data: buffer.slice(0, openIdx) };
        }
        buffer = buffer.slice(openIdx + '<think>'.length);
        state = 'reasoning';
      } else if (state === 'reasoning') {
        // Look for </think> closing
        const closeIdx = buffer.indexOf('</think>');
        if (closeIdx === -1) {
          // Buffer reasoning, keep last TAG_LOOKAHEAD chars as guard
          const safeLen = Math.max(0, buffer.length - TAG_LOOKAHEAD);
          if (safeLen > 0) {
            yield { type: 'reasoning', data: buffer.slice(0, safeLen) };
            buffer = buffer.slice(safeLen);
          }
          break;
        }
        // Emit reasoning up to close tag
        if (closeIdx > 0) {
          yield { type: 'reasoning', data: buffer.slice(0, closeIdx) };
        }
        buffer = buffer.slice(closeIdx + '</think>'.length);
        state = 'content';
      } else {
        break;
      }
    }
  }

  // Flush remaining buffer
  if (buffer.length > 0) {
    if (state === 'reasoning') {
      yield { type: 'reasoning', data: buffer };
    } else {
      yield { type: 'token', data: buffer };
    }
  }

  yield { type: 'done' };
}

/**
 * Serialize an SseEvent to the SSE wire format.
 * e.g. `data: {"type":"token","data":"hello"}\n\n`
 */
export function serializeSseEvent(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Convert a fetch Response body (OpenAI-compat streaming) to text chunks.
 * Parses `data: {"choices":[{"delta":{"content":"..."}}]}` lines.
 */
export async function* openAiStreamToChunks(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let partial = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      partial += decoder.decode(value, { stream: true });

      const lines = partial.split('\n');
      partial = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice('data:'.length).trim();
        if (jsonStr === '[DONE]') return;
        try {
          const parsed = JSON.parse(jsonStr) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) yield delta.content;
          // DeepSeek R1 surfaces reasoning separately in some modes
          if (delta?.reasoning_content) yield `<think>${delta.reasoning_content}</think>`;
        } catch {
          // skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
