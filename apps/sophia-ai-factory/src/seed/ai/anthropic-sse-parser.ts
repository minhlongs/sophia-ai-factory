/**
 * Anthropic SSE Parser — Phase 4N
 *
 * Pure generator that parses Anthropic Messages API SSE stream
 * (https://api.anthropic.com/v1/messages with stream:true) into a typed
 * discriminated-union event stream.
 *
 * Supports text streaming AND tool-use streaming (input_json_delta).
 * Caller assembles partial_json fragments into a full JSON input payload.
 */

import {
  mapAnthropicSseEvent,
  type AnthropicContentBlockMeta,
  type AnthropicStreamEvent,
  type RawSseEvent,
} from './anthropic-sse-event-mapper'

export type { AnthropicContentBlockMeta, AnthropicStreamEvent }

/**
 * Consume an SSE reader and yield Anthropic stream events.
 *
 * Line-buffer impl: handles chunk boundaries mid-event (Phase 4L L-3).
 * Final flush on stream close ensures last line without trailing `\n` is parsed.
 */
export async function* parseAnthropicSse(
  reader:  ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder = new TextDecoder('utf-8'),
): AsyncGenerator<AnthropicStreamEvent, void, unknown> {
  let buffer = ''

  const tryEmit = function* (line: string): Generator<AnthropicStreamEvent, void, unknown> {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    let raw: RawSseEvent
    try { raw = JSON.parse(payload) as RawSseEvent }
    catch (err) {
      const reason = err instanceof Error ? err.message : 'JSON parse failed'
      yield { type: 'parse_error', reason, rawPayload: payload.slice(0, 200) }
      return
    }
    const event = mapAnthropicSseEvent(raw)
    if (event) yield event
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let eol: number
      while ((eol = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, eol)
        buffer = buffer.slice(eol + 1)
        yield* tryEmit(line)
      }
    }

    if (buffer.length > 0) {
      yield* tryEmit(buffer)
      buffer = ''
    }
  } finally {
    reader.cancel().catch(() => { /* already released */ })
  }
}
