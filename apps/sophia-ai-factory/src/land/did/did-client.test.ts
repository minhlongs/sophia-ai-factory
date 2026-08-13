/**
 * Tests for D-ID client — verifies request shape + error mapping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock circuit breaker — allow all requests in tests
vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: () => true,
  recordSuccess: () => {},
  recordFailure: () => {},
}))

vi.mock('@/seed/types/failure-kind', () => ({
  classifyError: () => 'SERVER_ERROR' as never,
}))

import { createDidTalk } from './did-client'

describe('createDidTalk', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns id+status on success', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'talk_abc', status: 'created' }), { status: 201 }),
    )

    const result = await createDidTalk('basic-key', {
      sourceUrl: 'https://r2.example/p.png',
      script: 'Hello',
    })
    expect(result).toEqual({ id: 'talk_abc', status: 'created' })
  })

  it('sends Authorization: Basic <key> header', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 't' }), { status: 201 }))

    await createDidTalk('my-key', { sourceUrl: 'https://x/p.png', script: 'hi' })
    const args = fetchMock.mock.calls[0]
    expect((args[1] as RequestInit).headers).toMatchObject({ Authorization: 'Basic my-key' })
  })

  it('throws DidErrorResponse on non-2xx', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }))

    await expect(
      createDidTalk('bad-key', { sourceUrl: 'https://x/p.png', script: 'hi' }),
    ).rejects.toMatchObject({ code: 'did_403', status: 403 })
  })

  it('throws did_no_id when response missing id', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'created' }), { status: 201 }))

    await expect(
      createDidTalk('key', { sourceUrl: 'https://x/p.png', script: 'hi' }),
    ).rejects.toMatchObject({ code: 'did_no_id' })
  })

  it('defaults voice_id to en-US-JennyNeural', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 't' }), { status: 201 }))

    await createDidTalk('key', { sourceUrl: 'https://x/p.png', script: 'hi' })
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.script.provider.voice_id).toBe('en-US-JennyNeural')
  })
})
