/**
 * Tests for anthropic-adapter — Phase 4J + 4L
 *
 * 4J (5): happy path / missing key / HTTP error / empty content / network throw
 * 4L full (4): tool_use block / custom maxTokens / tools param / system prompt
 * 4L stream (4): text_delta yield / missing key / HTTP error / missing body
 * Uses vi.fn() on global.fetch — no real network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  callAnthropic,
  callAnthropicFull,
  callAnthropicStream,
  callAnthropicStreamEvents,
  type AnthropicStreamEvent,
  type AnthropicTool,
  type AnthropicToolUseBlock,
} from './anthropic-adapter'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAnthropicBody(text: string) {
  return JSON.stringify({
    id:            'msg_test_001',
    type:          'message',
    role:          'assistant',
    content:       [{ type: 'text', text }],
    model:         'claude-sonnet-4-6',
    stop_reason:   'end_turn',
    stop_sequence: null,
    usage:         { input_tokens: 10, output_tokens: 5 },
  })
}

const BASE_PARAMS = {
  model:    'claude-sonnet-4-6',
  messages: [{ role: 'user' as const, content: 'Hello Anthropic' }],
  apiKey:   'sk-ant-test-key',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('callAnthropic', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── Test 1: happy path ─────────────────────────────────────────────────────

  it('happy path: returns text from first content block', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(makeAnthropicBody('hello'), {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await callAnthropic(BASE_PARAMS)

    expect(result).toBe('hello')
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce()

    // Verify correct headers sent
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-test-key')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['content-type']).toBe('application/json')

    // Verify body shape
    const body = JSON.parse(init.body as string) as {
      model: string
      max_tokens: number
      messages: { role: string; content: string }[]
    }
    expect(body.model).toBe('claude-sonnet-4-6')
    expect(body.max_tokens).toBe(1024)
    expect(body.messages[0].content).toBe('Hello Anthropic')
  })

  // ── Test 2: missing apiKey ─────────────────────────────────────────────────

  it('missing apiKey: throws early without calling fetch', async () => {
    await expect(
      callAnthropic({ ...BASE_PARAMS, apiKey: '' }),
    ).rejects.toThrow('ANTHROPIC_MISSING_API_KEY')

    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  // ── Test 3: HTTP 500 ───────────────────────────────────────────────────────

  it('HTTP 500: throws with status code in message', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    )

    await expect(callAnthropic(BASE_PARAMS)).rejects.toThrow('ANTHROPIC_HTTP_500')
  })

  // ── Test 4: empty content array ────────────────────────────────────────────

  it('empty content array: throws ANTHROPIC_EMPTY_RESPONSE', async () => {
    const emptyBody = JSON.stringify({
      id:      'msg_empty',
      type:    'message',
      role:    'assistant',
      content: [],  // empty — no text block
      model:   'claude-sonnet-4-6',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage:   { input_tokens: 5, output_tokens: 0 },
    })

    vi.mocked(fetch).mockResolvedValue(
      new Response(emptyBody, {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(callAnthropic(BASE_PARAMS)).rejects.toThrow('ANTHROPIC_EMPTY_RESPONSE')
  })

  // ── Test 5: network throws ─────────────────────────────────────────────────

  it('network error: propagates the original error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Failed to fetch: ECONNREFUSED'))

    await expect(callAnthropic(BASE_PARAMS)).rejects.toThrow('Failed to fetch: ECONNREFUSED')
  })
})

// ── Phase 4L: callAnthropicFull (tool-use + params) ──────────────────────────

describe('callAnthropicFull', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns full response with tool_use content block', async () => {
    const toolUseBody = JSON.stringify({
      id:   'msg_tool_001',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'toolu_abc', name: 'get_weather', input: { location: 'Hanoi' } },
      ],
      model:         'claude-sonnet-4-6',
      stop_reason:   'tool_use',
      stop_sequence: null,
      usage:         { input_tokens: 20, output_tokens: 15 },
    })

    vi.mocked(fetch).mockResolvedValue(
      new Response(toolUseBody, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const result = await callAnthropicFull(BASE_PARAMS)
    expect(result.content).toHaveLength(1)
    const block = result.content[0] as AnthropicToolUseBlock
    expect(block.type).toBe('tool_use')
    expect(block.name).toBe('get_weather')
    expect(block.input).toEqual({ location: 'Hanoi' })
    expect(result.stop_reason).toBe('tool_use')
  })

  it('respects custom maxTokens in request body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(makeAnthropicBody('ok'), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    await callAnthropicFull({ ...BASE_PARAMS, maxTokens: 4096 })

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { max_tokens: number }
    expect(body.max_tokens).toBe(4096)
  })

  it('includes tools and system fields when provided', async () => {
    const tools: AnthropicTool[] = [
      { name: 'get_weather', description: 'Get weather', input_schema: { type: 'object', properties: {} } },
    ]

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeAnthropicBody('ok'), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    await callAnthropicFull({ ...BASE_PARAMS, tools, system: 'You are a helpful weather bot.' })

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as {
      tools: AnthropicTool[]
      system: string
    }
    expect(body.tools).toEqual(tools)
    expect(body.system).toBe('You are a helpful weather bot.')
  })

  it('omits tools and system when not provided', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(makeAnthropicBody('ok'), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    await callAnthropicFull(BASE_PARAMS)

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).not.toHaveProperty('tools')
    expect(body).not.toHaveProperty('system')
    expect(body).not.toHaveProperty('stream')
  })
})

// ── Phase 4L: callAnthropicStream (SSE streaming) ────────────────────────────

describe('callAnthropicStream', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    })
  }

  it('yields text_delta chunks from SSE stream', async () => {
    const sseChunks = [
      'event: message_start\n',
      'data: {"type":"message_start"}\n\n',
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":", world"}}\n\n',
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"!"}}\n\n',
      'event: message_stop\n',
      'data: {"type":"message_stop"}\n\n',
    ]

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeSseStream(sseChunks), {
        status:  200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    const deltas: string[] = []
    for await (const chunk of callAnthropicStream(BASE_PARAMS)) {
      deltas.push(chunk)
    }

    expect(deltas).toEqual(['Hello', ', world', '!'])

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { stream: boolean }
    expect(body.stream).toBe(true)
  })

  it('missing apiKey: throws early without calling fetch', async () => {
    const gen = callAnthropicStream({ ...BASE_PARAMS, apiKey: '' })
    await expect(gen.next()).rejects.toThrow('ANTHROPIC_MISSING_API_KEY')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('HTTP 500: throws on first next() with status code', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    )

    const gen = callAnthropicStream(BASE_PARAMS)
    await expect(gen.next()).rejects.toThrow('ANTHROPIC_HTTP_500')
  })

  it('null body: throws ANTHROPIC_NO_STREAM_BODY', async () => {
    // Construct a Response with status 200 but null body
    const fakeResponse = {
      ok:     true,
      status: 200,
      body:   null,
      text:   async () => '',
    } as unknown as Response

    vi.mocked(fetch).mockResolvedValue(fakeResponse)

    const gen = callAnthropicStream(BASE_PARAMS)
    await expect(gen.next()).rejects.toThrow('ANTHROPIC_NO_STREAM_BODY')
  })

  // ── Phase 4N L-3: chunk boundary mid-event split ─────────────────────────

  it('handles SSE event split across chunk boundary', async () => {
    // The "data: {...}\n\n" is split deliberately inside the JSON payload.
    const sseChunks = [
      'event: content_block_delta\ndata: {"type":"content_bl',
      'ock_delta","index":0,"delta":{"type":"text_delta","text":"Split"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"OK"}}\n\n',
    ]

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeSseStream(sseChunks), {
        status:  200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    const deltas: string[] = []
    for await (const chunk of callAnthropicStream(BASE_PARAMS)) {
      deltas.push(chunk)
    }
    expect(deltas).toEqual(['Split', 'OK'])
  })
})

// ── Phase 4N: callAnthropicStreamEvents (structured tool-use + text stream) ──

function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

describe('callAnthropicStreamEvents', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('emits full tool_use flow (start → input_json_delta → stop → message_delta)', async () => {
    const sseChunks = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_abc"}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_01","name":"get_weather"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"location\\":"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\\"Hanoi\\"}"}}\n\n',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ]

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeSseStream(sseChunks), { status: 200 }),
    )

    const events: AnthropicStreamEvent[] = []
    for await (const e of callAnthropicStreamEvents(BASE_PARAMS)) events.push(e)

    expect(events).toHaveLength(7)
    expect(events[0]).toEqual({ type: 'message_start', messageId: 'msg_abc' })
    expect(events[1]).toEqual({
      type:  'content_block_start',
      index: 0,
      block: { type: 'tool_use', id: 'toolu_01', name: 'get_weather' },
    })
    expect(events[2]).toEqual({ type: 'input_json_delta', index: 0, partialJson: '{"location":' })
    expect(events[3]).toEqual({ type: 'input_json_delta', index: 0, partialJson: '"Hanoi"}' })
    expect(events[4]).toEqual({ type: 'content_block_stop', index: 0 })
    expect(events[5]).toEqual({ type: 'message_delta', stopReason: 'tool_use', stopSequence: null })
    expect(events[6]).toEqual({ type: 'message_stop' })

    // Assemble partial_json → full input
    const partials = events
      .filter((e): e is Extract<AnthropicStreamEvent, { type: 'input_json_delta' }> => e.type === 'input_json_delta')
      .map((e) => e.partialJson)
      .join('')
    expect(JSON.parse(partials)).toEqual({ location: 'Hanoi' })
  })

  it('emits message_delta.stop_reason for text completion (L-2)', async () => {
    const sseChunks = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"done"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ]

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeSseStream(sseChunks), { status: 200 }),
    )

    const events: AnthropicStreamEvent[] = []
    for await (const e of callAnthropicStreamEvents(BASE_PARAMS)) events.push(e)

    const msgDelta = events.find((e) => e.type === 'message_delta')
    expect(msgDelta).toEqual({ type: 'message_delta', stopReason: 'end_turn', stopSequence: null })
  })

  it('skips malformed JSON and unknown event types', async () => {
    const sseChunks = [
      'data: {not valid json\n\n',
      'data: {"type":"ping"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}\n\n',
    ]

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeSseStream(sseChunks), { status: 200 }),
    )

    const events: AnthropicStreamEvent[] = []
    for await (const e of callAnthropicStreamEvents(BASE_PARAMS)) events.push(e)

    expect(events).toEqual([{ type: 'text_delta', index: 0, text: 'hi' }])
  })
})

// ── Phase 4N L-1: httpError body truncation ──────────────────────────────────

describe('httpError body truncation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('truncates upstream error body to 500 chars', async () => {
    const longBody = 'X'.repeat(1000)
    vi.mocked(fetch).mockResolvedValue(new Response(longBody, { status: 400 }))

    await expect(callAnthropicFull(BASE_PARAMS)).rejects.toThrow(/\.\.\.\[truncated\]$/)

    try {
      await callAnthropicFull(BASE_PARAMS)
    } catch (err) {
      const msg = (err as Error).message
      // Expected format: "ANTHROPIC_HTTP_400: XXX...X...[truncated]"
      // Total: prefix + 500 chars + "...[truncated]"
      expect(msg.includes('ANTHROPIC_HTTP_400')).toBe(true)
      expect(msg.length).toBeLessThan(600)  // way less than original 1000
    }
  })

  it('does NOT truncate short error bodies', async () => {
    const shortBody = 'bad request'
    vi.mocked(fetch).mockResolvedValue(new Response(shortBody, { status: 400 }))

    await expect(callAnthropicFull(BASE_PARAMS)).rejects.toThrow('ANTHROPIC_HTTP_400: bad request')
  })
})
