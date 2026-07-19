import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { CogVideoXAdapter } from './cogvideox-adapter'
import { ProviderInvalidKeyError, ProviderQuotaExceededError, ProviderNetworkError, MissingCredentialsError } from '@/seed/services/errors'

function buildResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('CogVideoXAdapter', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  const mkAdapter = (apiKey?: string | null, baseUrl?: string) => {
    const getApiKey = (_p: string) => (apiKey === null ? undefined : apiKey ?? 'test-zhipu-key')
    return new CogVideoXAdapter(getApiKey, baseUrl)
  }

  it('identity', () => {
    const a = mkAdapter('key')
    expect(a.id).toBe('cogvideox')
    expect(a.capabilities.generationTypes).toEqual(['text_to_video'])
    expect(a.capabilities.maxDurationSeconds).toBe(10)
    expect(a.capabilities.maxResolution).toBe('1920x1080')
  })

  describe('generateTextToVideo', () => {
    it('throws MissingCredentialsError when no key and no baseUrl', async () => {
      const adapter = mkAdapter(null)
      await expect(adapter.generateTextToVideo({ prompt: 'x', negativePrompt: '', durationSeconds: 5, aspectRatio: '16:9', cfgScale: 7.5 }))
        .rejects.toBeInstanceOf(MissingCredentialsError)
    })

    it('happy path: returns async result (non-done)', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ id: 'task_1', task_status: 'PROCESSING', request_id: 'req_1' }))
      const result = await adapter.generateTextToVideo({ prompt: 'a sunset', negativePrompt: '', durationSeconds: 5, aspectRatio: '16:9', cfgScale: 7.5 })
      expect(result.jobId).toBe('task_1')
      expect(result.synchronous).toBe(false)
      expect(result.estimatedDuration).toBe(120)
    })

    it('uses self-hosted baseUrl when provided', async () => {
      const adapter = mkAdapter(null, 'http://localhost:8080')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ id: 'h1', task_status: 'PROCESSING' }))
      await adapter.generateTextToVideo({ prompt: 'x', negativePrompt: '' })
      expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://localhost:8080/v1/videos/generations', expect.objectContaining({ method: 'POST' }))
    })

    it('throws ProviderInvalidKeyError on HTTP 401', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 401))
      await expect(adapter.generateTextToVideo({ prompt: 'x', negativePrompt: '' })).rejects.toBeInstanceOf(ProviderInvalidKeyError)
    })

    it('throws ProviderQuotaExceededError on HTTP 429', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 429))
      await expect(adapter.generateTextToVideo({ prompt: 'x', negativePrompt: '' })).rejects.toBeInstanceOf(ProviderQuotaExceededError)
    })

    it('throws ProviderNetworkError on body task_status=FAIL', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ id: 't1', task_status: 'FAIL' }))
      await expect(adapter.generateTextToVideo({ prompt: 'x', negativePrompt: '' })).rejects.toBeInstanceOf(ProviderNetworkError)
    })

    it('throws Error on fetch reject (no catch in adapter)', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockRejectedValue(new Error('conn refused'))
      await expect(adapter.generateTextToVideo({ prompt: 'x', negativePrompt: '' })).rejects.toThrow('conn refused')
    })
  })

  describe('unsupported types', () => {
    it('generateTalkingHead throws', async () => {
      const adapter = mkAdapter('key')
      await expect(adapter.generateTalkingHead({ script: 'hi', avatarImageUrl: '', avatarImageData: '', voiceId: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 }))
        .rejects.toThrow('talking_head is not supported')
    })

    it('generateVoiceover throws', async () => {
      const adapter = mkAdapter('key')
      await expect(adapter.generateVoiceover({ script: 'hi', voiceId: 'v', outputFormat: 'mp3' }))
        .rejects.toThrow('voiceover is not supported')
    })
  })

  describe('getJobStatus', () => {
    it('maps SUCCESS→completed, FAIL→failed', async () => {
      const adapter = mkAdapter('key')
      for (const [s, e] of [['SUCCESS', 'completed'], ['FAIL', 'failed'], ['PROCESSING', 'processing'], ['PENDING', 'queued']] as const) {
        vi.mocked(fetch).mockResolvedValue(buildResponse({ task_status: s, video_result: [{ url: 'url', cover_url: 'cover' }] }))
        const r = await adapter.getJobStatus('jid')
        expect(r.status).toBe(e)
      }
      vi.mocked(fetch).mockClear()
    })

    it('includes thumbnailUrl and error from task_status_msg', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ task_status: 'FAIL', task_status_msg: 'model error', video_result: [{ url: 'url', cover_url: 'c' }] }))
      const r = await adapter.getJobStatus('jid')
      expect(r.videoUrl).toBe('url')
      expect(r.thumbnailUrl).toBe('c')
      expect(r.error).toBe('model error')
    })

    it('uses baseUrl path when provided', async () => {
      const adapter = mkAdapter(null, 'http://localhost:8080')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ task_status: 'PENDING' }))
      await adapter.getJobStatus('jid_abc')
      expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://localhost:8080/v1/videos/generations/jid_abc', expect.anything())
    })
  })

  describe('cancelJob', () => {
    it('returns true on 200', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))
      expect(await adapter.cancelJob('jid')).toBe(true)
    })

    it('uses baseUrl path when provided', async () => {
      const adapter = mkAdapter(null, 'http://localhost:8080')
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))
      await adapter.cancelJob('jid')
      expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://localhost:8080/v1/videos/generations/jid/cancel', expect.objectContaining({ method: 'POST' }))
    })
  })

  describe('healthCheck', () => {
    it('returns healthy=true on 200 (remote)', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(new Response('ok', { status: 200 }))
      const r = await adapter.healthCheck()
      expect(r.healthy).toBe(true)
    })

    it('returns healthy=false on network error', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockRejectedValue(new Error('timeout'))
      const r = await adapter.healthCheck()
      expect(r.healthy).toBe(false)
    })
  })

  describe('estimateCost', () => {
    it('non-text_to_video returns unavailable', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'talking_head', params: { prompt: 'x', negativePrompt: '', durationSeconds: 5, aspectRatio: '16:9' } })
      expect(r.confidence).toBe('unavailable')
    })

    it('text_to_video: amount = duration * 0.15', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'text_to_video', params: { prompt: 'x', negativePrompt: '', durationSeconds: 10, aspectRatio: '16:9' } })
      expect(r.amount).toBe(1.5)
      expect(r.unit).toBe('usd')
      expect(r.confidence).toBe('estimated')
    })
  })
})
