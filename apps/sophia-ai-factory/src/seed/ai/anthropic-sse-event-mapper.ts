/**
 * Anthropic SSE Event Types & Raw Payload Mapper
 *
 * Maps raw Anthropic Messages API SSE event payloads into the typed
 * discriminated-union `AnthropicStreamEvent`.
 *
 * @module seed/ai/anthropic-sse-event-mapper
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
  /** Emitted when an SSE payload fails JSON.parse. */
  | { type: 'parse_error';         reason: string; rawPayload: string }

export interface RawSseEvent {
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

export function mapAnthropicSseEvent(raw: RawSseEvent): AnthropicStreamEvent | null {
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
