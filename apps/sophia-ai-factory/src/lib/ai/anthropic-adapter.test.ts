/**
 * Tests for anthropic-adapter — Phase 4J
 *
 * 5 cases: happy path / missing key / HTTP error / empty content / network throw
 * Uses vi.fn() on global.fetch — no real network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callAnthropic } from './anthropic-adapter'

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
