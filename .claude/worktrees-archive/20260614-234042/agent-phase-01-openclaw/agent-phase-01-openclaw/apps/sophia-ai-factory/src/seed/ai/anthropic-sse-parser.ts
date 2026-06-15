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

export interface AnthropicContentBlockMeta {
  type:  'text' | 'tool_use'
  id?:   string
  name?: string
}

export type AnthropicStreamEvent =
  | { type: 'message_start';       messageId: string }
  | { type: 'content_block_start'; index: number; block: AnthropicContentBlockMeta }
  | { type: 'text_delta';          index: number; text: string }
  | { type: 'input_json_delta';    index: number; partialJson: string }
  | { type: 'content_block_stop';  index: number }
  | { type: 'message_delta';       stopReason: string | null; stopSequence: string | null }
  | { type: 'message_stop' }
  /** Phase 4N-POLISH: emitted when an SSE payload fails JSON.parse. */
  | { type: 'parse_error';         reason: string; rawPayload: string }

interface RawSseEvent {
  type?:  string
  index?: number
  delta?: {
    type?:          string
    text?:          string
    partial_json?:  string
    stop_reason?:   string | null
    stop_sequence?: string | null
  }
  message?:       { id?: string }
  content_block?: { type?: string; id?: string; name?: string }
}

function mapEvent(raw: RawSseEvent): AnthropicStreamEvent | null {
  switch (raw.type) {
    case 'message_start':
      return { type: 'message_start', messageId: raw.message?.id ?? '' }

    case 'content_block_start':
      if (raw.index === undefined || !raw.content_block?.type) return null
      return {
        type:  'content_block_start',
        index: raw.index,
        block: {
          type: raw.content_block.type as 'text' | 'tool_use',
          id:   raw.content_block.id,
          name: raw.content_block.name,
        },
      }

    case 'content_block_delta':
      if (raw.index === undefined || !raw.delta) return null
      if (raw.delta.type === 'text_delta' && typeof raw.delta.text === 'string') {
        return { type: 'text_delta', index: raw.index, text: raw.delta.text }
      }
      if (raw.delta.type === 'input_json_delta' && typeof raw.delta.partial_json === 'string') {
        return { type: 'input_json_delta', index: raw.index, partialJson: raw.delta.partial_json }
      }
      return null

    case 'content_block_stop':
      if (raw.index === undefined) return null
      return { type: 'content_block_stop', index: raw.index }

    case 'message_delta':
      return {
        type:         'message_delta',
        stopReason:   raw.delta?.stop_reason   ?? null,
        stopSequence: raw.delta?.stop_sequence ?? null,
      }

    case 'message_stop':
      return { type: 'message_stop' }

    default:
      return null
  }
}

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
      // Phase 4N-POLISH M-2: surface malformed events instead of silent drop;
      // consumer can log / count without breaking the stream.
      yield { type: 'parse_error', reason, rawPayload: payload.slice(0, 200) }
      return
    }
    const event = mapEvent(raw)
    if (event) yield event
  }

  // Phase 4N-POLISH L-6: always release the reader when the consumer
  // stops early (break / throw / return). Without this, the underlying
  // fetch connection would stay half-open until GC.
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
