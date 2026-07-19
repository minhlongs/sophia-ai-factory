import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { DuixAvatarAdapter } from './duix-avatar-adapter'
import { ProviderInvalidKeyError, ProviderQuotaExceededError, ProviderNetworkError, MissingCredentialsError } from '@/seed/services/errors'

function buildResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

describe('DuixAvatarAdapter', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  const mkAdapter = (apiKey?: string | null) => {
    const getApiKey = (_p: string) => (apiKey === null ? undefined : apiKey ?? 'test-duix-key')
    return new DuixAvatarAdapter(getApiKey)
  }

  it('identity: duix-avatar id, voiceCloning=true, maxDuration=180', () => {
    const a = mkAdapter('key')
    expect(a.id).toBe('duix-avatar')
    expect(a.capabilities.voiceCloning).toBe(true)
    expect(a.capabilities.maxDurationSeconds).toBe(180)
    expect(a.capabilities.generationTypes).toEqual(['talking_head', 'voiceover'])
  })

  describe('generateTalkingHead', () => {
    it('throws MissingCredentialsError when apiKey absent', async () => {
      const adapter = mkAdapter(null)
      await expect(adapter.generateTalkingHead({ avatarId: 'av1', script: 'hi', voiceId: 'v1', avatarImageUrl: '', avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 }))
        .rejects.toBeInstanceOf(MissingCredentialsError)
    })

    it('happy path: returns result with videoUrl', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ job_id: 'jt1', status: 'completed', video_url: 'https://cdn/out.mp4' }))
      const result = await adapter.generateTalkingHead({ avatarId: 'av1', script: 'hello', voiceId: 'v1', avatarImageUrl: '', avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 })
      expect(result.videoUrl).toBe('https://cdn/out.mp4')
      expect(result.jobId).toBe('jt1')
    })

    it('throws ProviderInvalidKeyError on HTTP 401', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 401))
      await expect(adapter.generateTalkingHead({ avatarId: 'av1', script: 'x', voiceId: 'v1', avatarImageUrl: '', avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 }))
        .rejects.toBeInstanceOf(ProviderInvalidKeyError)
    })

    it('throws ProviderQuotaExceededError on HTTP 429', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 429))
      await expect(adapter.generateTalkingHead({ avatarId: 'av1', script: 'x', voiceId: 'v1', avatarImageUrl: '', avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 }))
        .rejects.toBeInstanceOf(ProviderQuotaExceededError)
    })

    it('throws ProviderNetworkError on HTTP 500', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 500))
      await expect(adapter.generateTalkingHead({ avatarId: 'av1', script: 'x', voiceId: 'v1', avatarImageUrl: '', avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 }))
        .rejects.toBeInstanceOf(ProviderNetworkError)
    })

    it('sends POST to /avatars/talks', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ job_id: 'j1', status: 'completed' }))
      await adapter.generateTalkingHead({ avatarId: 'av1', script: 'hi', voiceId: 'v1', avatarImageUrl: '', avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 })
      const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.duix.ai/v1/avatars/talks')
      expect(init.method).toBe('POST')
      const body = JSON.parse(init.body as string)
      expect(body.avatar_id).toBe('av1')
      expect(body.script).toBe('hi')
      expect(body.voice_id).toBe('v1')
      expect(JSON.parse(init.body as string)).toMatchObject({ avatar_id: 'av1', script: 'hi', voice_id: 'v1' })
    })

    it('uses defaults for expression, subtitles, backgroundMusicUrl', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ job_id: 'j', status: 'completed' }))
      await adapter.generateTalkingHead({ avatarId: 'av1', script: 'hi', voiceId: '', avatarImageUrl: '', avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 })
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string)
      expect(body.expression).toBe('neutral')
      expect(body.subtitles_enabled).toBe(false)
      expect(body.background_music_url).toBeUndefined()
    })

    it('throws Error on fetch reject (no catch in adapter)', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'))
      await expect(adapter.generateTalkingHead({ avatarId: 'av1', script: 'hi', voiceId: 'v1', avatarImageUrl: 'http://example.com/face.png', avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 }))
        .rejects.toThrow('fetch failed')
    })
  })

  describe('generateVoiceover', () => {
    it('happy path: returns result with audioUrl', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ job_id: 'vo1', status: 'completed', audio_url: 'https://cdn/a.mp3' }))
      const result = await adapter.generateVoiceover({ script: 'hello', voiceId: 'v1', outputFormat: 'mp3', maxDurationSeconds: 30 })
      expect(result.audioUrl).toBe('https://cdn/a.mp3')
      expect(result.jobId).toBe('vo1')
    })

    it('throws MissingCredentialsError when apiKey absent', async () => {
      const adapter = mkAdapter(null)
      await expect(adapter.generateVoiceover({ script: 'x', voiceId: '', maxDurationSeconds: 10 })).rejects.toBeInstanceOf(MissingCredentialsError)
    })

    it('throws ProviderInvalidKeyError on HTTP 401', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 401))
      await expect(adapter.generateVoiceover({ script: 'x', voiceId: '', maxDurationSeconds: 10 })).rejects.toBeInstanceOf(ProviderInvalidKeyError)
    })

    it('throws ProviderQuotaExceededError on HTTP 429', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 429))
      await expect(adapter.generateVoiceover({ script: 'x', voiceId: '', maxDurationSeconds: 10 })).rejects.toBeInstanceOf(ProviderQuotaExceededError)
    })

    it('sends POST to /voice/generate', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ job_id: 'vo2', status: 'completed' }))
      await adapter.generateVoiceover({ script: 'text', voiceId: 'v', outputFormat: 'wav', maxDurationSeconds: 30 })
      const [url] = vi.mocked(fetch).mock.calls[0] as [string]
      expect(url).toBe('https://api.duix.ai/v1/voice/generate')
    })

    it('throws Error on fetch reject (no catch in adapter)', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockRejectedValue(new Error('net err'))
      await expect(adapter.generateVoiceover({ script: 'x', voiceId: '', maxDurationSeconds: 10 })).rejects.toThrow('net err')
    })
  })

  describe('generateTextToVideo', () => {
    it('always throws (unsupported)', async () => {
      const adapter = mkAdapter('key')
      await expect(adapter.generateTextToVideo({ prompt: 'x', negativePrompt: '', durationSeconds: 5, aspectRatio: '16:9', cfgScale: 7.5 }))
        .rejects.toThrow('text_to_video is not supported')
    })
  })

  describe('getJobStatus', () => {
    it('maps completed, failed, processing, queued, cancelled', async () => {
      const adapter = mkAdapter('key')
      for (const [status, expected] of [['completed', 'completed'], ['failed', 'failed'], ['processing', 'processing'], ['queued', 'queued'], ['cancelled', 'cancelled']] as const) {
        vi.mocked(fetch).mockResolvedValue(buildResponse({ status, result_url: 'r', video_url: 'v', audio_url: 'a', thumbnail_url: 't', progress: 50, completed_at: '2026-01-01T00:00:00Z' }))
        const r = await adapter.getJobStatus('jid')
        expect(r.status).toBe(expected)
      }
      vi.mocked(fetch).mockClear()
    })

    it('maps result_url→videoUrl (fallback)', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ status: 'completed', result_url: 'https://cdn/fallback.mp4' }))
      const r = await adapter.getJobStatus('jid')
      expect(r.videoUrl).toBe('https://cdn/fallback.mp4')
    })

    it('throws ProviderNetworkError on HTTP 500', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 500))
      await expect(adapter.getJobStatus('jid')).rejects.toBeInstanceOf(ProviderNetworkError)
    })

    it('throws MissingCredentialsError when apiKey absent', async () => {
      const adapter = mkAdapter(null)
      vi.mocked(fetch).mockResolvedValue(buildResponse({ status: 'completed' }))
      await expect(adapter.getJobStatus('jid')).rejects.toBeInstanceOf(MissingCredentialsError)
    })
  })

  describe('cancelJob', () => {
    it('returns true on 200', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))
      expect(await adapter.cancelJob('jid')).toBe(true)
    })

    it('returns false on 404', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))
      expect(await adapter.cancelJob('jid')).toBe(false)
    })

    it('throws on 500', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))
      await expect(adapter.cancelJob('jid')).rejects.toBeInstanceOf(ProviderNetworkError)
    })

    it('throws MissingCredentialsError when apiKey absent', async () => {
      const adapter = mkAdapter(null)
      await expect(adapter.cancelJob('jid')).rejects.toBeInstanceOf(MissingCredentialsError)
    })
  })

  describe('healthCheck', () => {
    it('returns healthy=true on 200', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(new Response('ok', { status: 200 }))
      const r = await adapter.healthCheck()
      expect(r.healthy).toBe(true)
      expect(r.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('returns healthy=false on network error', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockRejectedValue(new Error('timeout'))
      const r = await adapter.healthCheck()
      expect(r.healthy).toBe(false)
      expect(r.latencyMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('estimateCost', () => {
    it('text_to_video returns unavailable', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'text_to_video', params: { prompt: 'x', negativePrompt: '', durationSeconds: 5, aspectRatio: '16:9' } })
      expect(r.confidence).toBe('unavailable')
    })

    it('talking_head cost = word count * 0.06', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'talking_head', params: { script: 'hello world test', avatarId: 'a', voiceId: 'v', avatarImageUrl: '', avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 } })
      expect(r.amount).toBeCloseTo(0.12, 2) // ceil(3/2.5)=2, 2*0.06=0.12
    })

    it('voiceover cost = word count * 0.04', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'voiceover', params: { script: 'hi', voiceId: '', outputFormat: 'mp3', maxDurationSeconds: 5 } })
      expect(r.amount).toBeCloseTo(0.04, 2) // 1 word, ceil(1/2.5)=1, 1*0.04=0.04
    })
  })
})
