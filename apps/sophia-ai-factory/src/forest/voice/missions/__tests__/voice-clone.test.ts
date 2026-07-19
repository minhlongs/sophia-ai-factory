/**
 * Tests for voice:clone handler — P15 live wiring.
 *
 * Covers: stub fallback when no key, stub fallback when no samples,
 * live path with mocked fetch (success), ElevenLabs HTTP error, audio fetch error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn(),
}))

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { handle } from '../voice-clone';

const mockResolve = resolveUserApiKey as ReturnType<typeof vi.fn>

const baseCtx = {
  missionId: 'm-1',
  userId: 'u-1',
  command: 'voice:clone',
  params: { voice_name: 'Test Voice', description: 'A test' },
}

describe('voice:clone handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('falls back to stub when no ElevenLabs key resolved', async () => {
    mockResolve.mockResolvedValueOnce(null)
    const result = await handle({ ...baseCtx, params: { ...baseCtx.params, sample_urls: ['https://r2.example/a.mp3'] } })
    expect(result.ok).toBe(true)
    expect(result.data?.is_stub).toBe(true)
    expect(result.data?.stub_reason).toBe('no_byok_key')
  })

  it('falls back to stub when sample_urls is missing', async () => {
    mockResolve.mockResolvedValueOnce('eleven-key-xxx')
    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    expect(result.data?.is_stub).toBe(true)
    expect(result.data?.stub_reason).toBe('no_sample_urls')
  })

  it('calls ElevenLabs and returns live voice_id on success', async () => {
    mockResolve.mockResolvedValueOnce('eleven-key-xxx')
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>

    // Mock audio fetch: use string body and override blob() for jsdom FormData compat
    const audioRes = new Response('fake-audio', { status: 200 })
    vi.spyOn(audioRes, 'blob').mockResolvedValue(new Blob(['fake-audio']))
    fetchMock
      .mockResolvedValueOnce(audioRes)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ voice_id: 'voice-real-123', name: 'Test Voice', status: 'ready' }), {
          status: 200,
        }),
      )

    const result = await handle({
      ...baseCtx,
      params: { ...baseCtx.params, sample_urls: ['https://r2.example/a.mp3'] },
    })

    expect(result.ok).toBe(true)
    expect(result.data?.voice_id).toBe('voice-real-123')
    expect(result.data?.is_stub).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns ok=false with elevenlabs_<status> on API error', async () => {
    mockResolve.mockResolvedValueOnce('eleven-key-xxx')
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>

    const audioRes = new Response('x', { status: 200 })
    vi.spyOn(audioRes, 'blob').mockResolvedValue(new Blob(['x']))
    fetchMock
      .mockResolvedValueOnce(audioRes)
      .mockResolvedValueOnce(new Response('Bad Request', { status: 400 }))

    const result = await handle({
      ...baseCtx,
      params: { ...baseCtx.params, sample_urls: ['https://r2.example/a.mp3'] },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('elevenlabs_400')
  })

  it('returns ok=false when audio sample fetch fails', async () => {
    mockResolve.mockResolvedValueOnce('eleven-key-xxx')
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    const result = await handle({
      ...baseCtx,
      params: { ...baseCtx.params, sample_urls: ['https://r2.example/missing.mp3'] },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('voice_clone_failed')
  })

  it('rejects non-https sample_urls silently (filtered to empty)', async () => {
    mockResolve.mockResolvedValueOnce('eleven-key-xxx')
    const result = await handle({
      ...baseCtx,
      params: { ...baseCtx.params, sample_urls: ['http://insecure.example/a.mp3'] },
    })
    expect(result.data?.is_stub).toBe(true)
    expect(result.data?.stub_reason).toBe('no_sample_urls')
  })
})
