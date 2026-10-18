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
import { openAiStreamToChunks } from './openai-stream-parser';

export { openAiStreamToChunks };

/** Max chars to buffer when looking for tag boundary */
const TAG_LOOKAHEAD = 64;

type ParseState = 'content' | 'reasoning' | 'tag_open' | 'tag_close';

interface BufferStepResult {
  events: SseEvent[];
  remainingBuffer: string;
  nextState: ParseState;
  done: boolean;
}

function flushContentBuffer(buffer: string): BufferStepResult {
  const openIdx = buffer.indexOf('<think>');
  if (openIdx === -1) {
    const safeLen = Math.max(0, buffer.length - TAG_LOOKAHEAD);
    const events: SseEvent[] = safeLen > 0 ? [{ type: 'token', data: buffer.slice(0, safeLen) }] : [];
    return {
      events,
      remainingBuffer: buffer.slice(safeLen),
      nextState: 'content',
      done: true,
    };
  }

  const events: SseEvent[] = [];
  if (openIdx > 0) {
    events.push({ type: 'token', data: buffer.slice(0, openIdx) });
  }
  return {
    events,
    remainingBuffer: buffer.slice(openIdx + '<think>'.length),
    nextState: 'reasoning',
    done: false,
  };
}

function flushReasoningBuffer(buffer: string): BufferStepResult {
  const closeIdx = buffer.indexOf('</think>');
  if (closeIdx === -1) {
    const safeLen = Math.max(0, buffer.length - TAG_LOOKAHEAD);
    const events: SseEvent[] = safeLen > 0 ? [{ type: 'reasoning', data: buffer.slice(0, safeLen) }] : [];
    return {
      events,
      remainingBuffer: buffer.slice(safeLen),
      nextState: 'reasoning',
      done: true,
    };
  }

  const events: SseEvent[] = [];
  if (closeIdx > 0) {
    events.push({ type: 'reasoning', data: buffer.slice(0, closeIdx) });
  }
  return {
    events,
    remainingBuffer: buffer.slice(closeIdx + '</think>'.length),
    nextState: 'content',
    done: false,
  };
}

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

    while (buffer.length > 0) {
      const step: BufferStepResult = state === 'content'
        ? flushContentBuffer(buffer)
        : flushReasoningBuffer(buffer);

      for (const event of step.events) {
        yield event;
      }
      buffer = step.remainingBuffer;
      state = step.nextState;

      if (step.done) {
        break;
      }
    }
  }

  // Flush remaining buffer
  if (buffer.length > 0) {
    yield { type: state === 'reasoning' ? 'reasoning' : 'token', data: buffer };
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
