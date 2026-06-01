/**
 * caption-translator.test.ts — Unit tests for caption translation
 *
 * Uses vi.mock to isolate OpenRouter and KV — no real API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateCaption } from './caption-translator'

// ---------------------------------------------------------------------------
// Mock: @opennextjs/cloudflare (KV)
// ---------------------------------------------------------------------------

const mockKvGet = vi.fn<(key: string) => Promise<string | null>>()
const mockKvPut = vi.fn<(key: string, value: string, options?: object) => Promise<void>>()

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({
    env: {
      EXPERIMENT_KV: {
        get: mockKvGet,
        put: mockKvPut,
      },
    },
  }),
}))

// ---------------------------------------------------------------------------
// Mock: withTimeout (OpenRouter fetch wrapper)
// ---------------------------------------------------------------------------

vi.mock('@/tree/byok/with-timeout', () => ({
  withTimeout: vi.fn(),
  BYOKTimeoutError: class BYOKTimeoutError extends Error {
    constructor(provider: string, timeoutMs: number) {
      super(`BYOK ${provider} timed out after ${timeoutMs}ms`)
    }
  },
}))

import { withTimeout } from '@/tree/byok/with-timeout'
const mockWithTimeout = vi.mocked(withTimeout)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOpenRouterResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('translateCaption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKvGet.mockResolvedValue(null)
    mockKvPut.mockResolvedValue(undefined)
  })

  it('returns original caption when byokKey is missing', async () => {
    const result = await translateCaption({
      source: 'Hello world',
      targetLocale: 'vi',
      charCap: 0,
    })

    expect(result.translated).toBe(false)
    expect(result.caption).toBe('Hello world')
    expect(result.warning).toContain('BYOK_KEY_MISSING')
    expect(mockWithTimeout).not.toHaveBeenCalled()
  })

  it('returns cached translation from KV', async () => {
    mockKvGet.mockResolvedValue('Xin chào thế giới')

    const result = await translateCaption({
      source: 'Hello world',
      targetLocale: 'vi',
      charCap: 0,
      byokKey: 'sk-test-key',
    })

    expect(result.caption).toBe('Xin chào thế giới')
    expect(result.fromCache).toBe(true)
    expect(result.translated).toBe(true)
    expect(mockWithTimeout).not.toHaveBeenCalled()
  })

  it('calls OpenRouter when KV cache is empty', async () => {
    mockKvGet.mockResolvedValue(null)
    mockWithTimeout.mockResolvedValue(makeOpenRouterResponse('Xin chào thế giới'))

    const result = await translateCaption({
      source: 'Hello world',
      targetLocale: 'vi',
      charCap: 0,
      byokKey: 'sk-test-key',
    })

    expect(result.caption).toBe('Xin chào thế giới')
    expect(result.translated).toBe(true)
    expect(result.fromCache).toBe(false)
    expect(mockWithTimeout).toHaveBeenCalledOnce()
    expect(mockKvPut).toHaveBeenCalledOnce()
  })

  it('falls back to original when OpenRouter returns empty', async () => {
    mockKvGet.mockResolvedValue(null)
    mockWithTimeout.mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    )

    const result = await translateCaption({
      source: 'Hello world',
      targetLocale: 'vi',
      charCap: 0,
      byokKey: 'sk-test-key',
    })

    expect(result.translated).toBe(false)
    expect(result.caption).toBe('Hello world')
    expect(result.warning).toContain('TRANSLATION_FAILED')
  })

  it('falls back to original when OpenRouter returns non-200', async () => {
    mockKvGet.mockResolvedValue(null)
    mockWithTimeout.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'Unauthorized' } }),
        { status: 401 },
      ),
    )

    const result = await translateCaption({
      source: 'Hello world',
      targetLocale: 'vi',
      charCap: 0,
      byokKey: 'sk-test-key',
    })

    expect(result.translated).toBe(false)
    expect(result.caption).toBe('Hello world')
  })

  it('falls back to original when OpenRouter throws', async () => {
    mockKvGet.mockResolvedValue(null)
    mockWithTimeout.mockRejectedValue(new Error('Network error'))

    const result = await translateCaption({
      source: 'Hello world',
      targetLocale: 'vi',
      charCap: 0,
      byokKey: 'sk-test-key',
    })

    expect(result.translated).toBe(false)
    expect(result.caption).toBe('Hello world')
  })

  it('enforces char cap on translated text', async () => {
    mockKvGet.mockResolvedValue(null)
    const longTranslation = 'A'.repeat(300)
    mockWithTimeout.mockResolvedValue(makeOpenRouterResponse(longTranslation))

    const result = await translateCaption({
      source: 'Hello world',
      targetLocale: 'en',
      charCap: 280, // Twitter cap
      byokKey: 'sk-test-key',
    })

    expect(result.caption.length).toBeLessThanOrEqual(280)
    expect(result.caption.endsWith('…')).toBe(true)
  })

  it('enforces char cap on cached text', async () => {
    const longCached = 'B'.repeat(300)
    mockKvGet.mockResolvedValue(longCached)

    const result = await translateCaption({
      source: 'Hello world',
      targetLocale: 'vi',
      charCap: 280,
      byokKey: 'sk-test-key',
    })

    expect(result.caption.length).toBeLessThanOrEqual(280)
    expect(result.fromCache).toBe(true)
  })

  it('handles invalid input gracefully', async () => {
    const result = await translateCaption({
      source: '',
      targetLocale: 'vi',
      charCap: 0,
      byokKey: 'sk-test-key',
    })

    expect(result.translated).toBe(false)
    expect(result.warning).toBeTruthy()
  })
})
