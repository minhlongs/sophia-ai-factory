/**
 * @module forest/ai/anthropic/message-streamer
 * Streaming response accumulator and SSE event generator.
 */

import type { StreamChunk } from '@/seed/ai/provider-interface';
import { parseAnthropicSse } from '@/seed/ai/anthropic-sse-parser';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Consumes Anthropic SSE reader and yields standardized StreamChunks.
 */
export async function* streamAnthropicMessages(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<StreamChunk, void, unknown> {
  try {
    for await (const event of parseAnthropicSse(reader)) {
      switch (event.type) {
        case 'text_delta':
          yield {
            type: 'text_delta',
            delta: event.text,
            done: false,
          };
          break;

        case 'message_stop':
          yield {
            type: 'text_delta',
            delta: '',
            done: true,
          };
          return;

        case 'parse_error':
          logger.warn('[AnthropicProvider] SSE parse error', undefined, {
            reason: event.reason,
            rawPayload: event.rawPayload,
          });
          break;

        default:
          // Other events (message_start, content_block_start, etc.)
          // are handled silently — only text deltas are surfaced.
          break;
      }
    }

    // Stream ended without explicit message_stop — emit final chunk
    yield {
      type: 'text_delta',
      delta: '',
      done: true,
    };
  } finally {
    reader.releaseLock();
  }
}
