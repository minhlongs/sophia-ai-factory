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
import { toError } from '@/seed/utils/to-error'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAnthropicBody(text: string) {
  return JSON.stringify({
    id: 'msg_test_001',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  })
}

const BASE_PARAMS = {
  model: 'claude-sonnet-4-6',
  messages: [{ role: 'user' as const, content: 'Hello Anthropic' }],
  apiKey: 'sk-ant-test-key',
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
        status: 200,
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
      id: 'msg_empty',
      type: 'message',
      role: 'assistant',
      content: [], // empty — no text block
      model: 'claude-sonnet-4-6',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 5, output_tokens: 0 },
    })

    // Clear any prior mock state (mock contamination from previous tests)
    vi.mocked(fetch).mockClear()
    vi.mocked(fetch).mockResolvedValue(
      new Response(emptyBody, {
        status: 200,
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
      id: 'msg_tool_001',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'I will use the tool.' },
        {
          type: 'tool_use',
          id: 'tool_001',
          name: 'get_weather',
          input: { city: 'Hanoi' },
        },
      ],
      model: 'claude-sonnet-4-6',
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 20, output_tokens: 15 },
    })

    vi.mocked(fetch).mockResolvedValue(
      new Response(toolUseBody, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await callAnthropicFull({
      ...BASE_PARAMS,
      tools: [{ name: 'get_weather', description: 'Get weather', input_schema: {} }],
    })

    expect(result.content).toHaveLength(2)
    expect(result.content[1]).toMatchObject({ type: 'tool_use', name: 'get_weather' })
  })

  it('forwards system prompt in body', async () => {
    const bodyWithSystem = makeAnthropicBody('hi')

    vi.mocked(fetch).mockResolvedValue(
      new Response(bodyWithSystem, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await callAnthropicFull({ ...BASE_PARAMS, system: 'You are a helpful assistant.' })

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const parsed = JSON.parse(init.body as string)
    expect(parsed.system).toBe('You are a helpful assistant.')
  })

  it('respects custom maxTokens', async () => {
    const body = makeAnthropicBody('ok')

    vi.mocked(fetch).mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await callAnthropicFull({ ...BASE_PARAMS, maxTokens: 2048 })

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const parsed = JSON.parse(init.body as string)
    expect(parsed.max_tokens).toBe(2048)
  })

  it('throws on HTTP 401', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Invalid API key', { status: 401 }),
    )

    await expect(callAnthropicFull(BASE_PARAMS)).rejects.toThrow('Invalid API key or unauthorized')
  })
})

// ── Phase 4L: Streaming tests ─────────────────────────────────────────────────

describe('callAnthropicStream', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('yields text_delta chunks', async () => {
    const sseBody = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-6","stop_reason":null,"usage":{"input_tokens":5,"output_tokens":0}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ].join('')

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseBody))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    const chunks: string[] = []
    for await (const chunk of callAnthropicStream(BASE_PARAMS)) {
      chunks.push(chunk)
    }

    // message_stop returns without yielding — no trailing empty string
    expect(chunks).toEqual(['Hello', ' world'])
  })

  it('throws on missing apiKey', async () => {
    // Async generators throw on first iteration, not on call — iterate to trigger
    await expect(async () => {
      for await (const _ of callAnthropicStream({ ...BASE_PARAMS, apiKey: '' })) {
        // should not reach here
      }
    }).rejects.toThrow('ANTHROPIC_MISSING_API_KEY')
  })

  it('throws on HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Server error', { status: 500 }),
    )

    await expect(async () => {
      for await (const _ of callAnthropicStream(BASE_PARAMS)) {
        // should not reach here
      }
    }).rejects.toThrow('ANTHROPIC_HTTP_500')
  })

  it('throws on missing response body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    await expect(async () => {
      for await (const _ of callAnthropicStream(BASE_PARAMS)) {
        // should not reach here
      }
    }).rejects.toThrow('ANTHROPIC_NO_STREAM_BODY')
  })
})

// ── Phase 4L: callAnthropicStreamEvents ──────────────────────────────────────

describe('callAnthropicStreamEvents', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('yields structured SSE events', async () => {
    const sseBody = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-6","stop_reason":null,"usage":{"input_tokens":5,"output_tokens":0}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ].join('')

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseBody))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    const events: AnthropicStreamEvent[] = []
    for await (const event of callAnthropicStreamEvents(BASE_PARAMS)) {
      events.push(event)
    }

    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events[0].type).toBe('message_start')
  })
})
