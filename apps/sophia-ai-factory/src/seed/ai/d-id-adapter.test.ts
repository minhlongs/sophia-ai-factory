import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { DIdAdapter } from './d-id-adapter'
import { ProviderInvalidKeyError, ProviderQuotaExceededError, ProviderNetworkError, MissingCredentialsError } from '@/seed/services/errors'

function buildResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

const AVATAR_URL = 'http://example.com/face.png'

describe('DIdAdapter', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  const mkAdapter = (apiKey?: string | null) => {
    const getApiKey = (_p: string) => (apiKey === null ? undefined : apiKey ?? 'test-did-key')
    return new DIdAdapter(getApiKey)
  }

  it('identity: class, id, label, capabilities', () => {
    const a = mkAdapter('key')
    expect(a).toBeInstanceOf(DIdAdapter)
    expect(a.id).toBe('d-id')
    expect(a.label).toBe('D-ID')
    expect(a.capabilities.generationTypes).toEqual(['talking_head', 'voiceover'])
    expect(a.capabilities.maxConcurrentJobs).toBe(10)
    expect(a.capabilities.voiceCloning).toBe(true)
    expect(a.capabilities.lipSync).toBe(true)
  })

  const TH_ARGS = { script: 'hi', voiceId: 'v1', avatarImageUrl: AVATAR_URL, avatarImageData: undefined, avatarImageFormat: 'image/png', maxDurationSeconds: 10 }

  describe('generateTalkingHead', () => {
    it('throws MissingCredentialsError when apiKey is absent', async () => {
      const adapter = mkAdapter(null)
      await expect(adapter.generateTalkingHead(TH_ARGS)).rejects.toBeInstanceOf(MissingCredentialsError)
    })

    it('happy path: returns synchronous result with videoUrl when status=done', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ id: 'job1', status: 'done', result_url: 'https://cdn/v.mp4' }))
      const result = await adapter.generateTalkingHead(TH_ARGS)
      expect(result.jobId).toBe('job1')
      expect(result.synchronous).toBe(true)
      expect(result.videoUrl).toBe('https://cdn/v.mp4')
      expect(result.estimatedDuration).toBe(30)
    })

    it('happy path: returns async result when status!=done', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ id: 'job2', status: 'started', duration: 15 }))
      const result = await adapter.generateTalkingHead(TH_ARGS)
      expect(result.jobId).toBe('job2')
      expect(result.synchronous).toBe(false)
    })

    it('throws ProviderInvalidKeyError on HTTP 401', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 401))
      await expect(adapter.generateTalkingHead(TH_ARGS)).rejects.toBeInstanceOf(ProviderInvalidKeyError)
    })

    it('throws ProviderQuotaExceededError on HTTP 402', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 402))
      await expect(adapter.generateTalkingHead(TH_ARGS)).rejects.toBeInstanceOf(ProviderQuotaExceededError)
    })

    it('throws ProviderQuotaExceededError on HTTP 429', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 429))
      await expect(adapter.generateTalkingHead(TH_ARGS)).rejects.toBeInstanceOf(ProviderQuotaExceededError)
    })

    it('throws ProviderNetworkError on HTTP 500', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 500))
        await expect(adapter.generateTalkingHead(TH_ARGS)).rejects.toThrow('Network error')
    })

    it('throws ProviderNetworkError when fetch throws', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockRejectedValue(new Error('network down'))
      await expect(adapter.generateTalkingHead(TH_ARGS)).rejects.toThrow('network down')
      expect(vi.mocked(fetch)).toHaveBeenCalledWith('https://api.d-id.com/talks', expect.objectContaining({ method: 'POST' }))
    })
  })

  describe('generateVoiceover', () => {
    it('happy path: returns synchronous result with audioUrl', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ id: 'vo1', status: 'done', result_url: 'https://cdn/a.mp3' }))
      const result = await adapter.generateVoiceover({ script: 'hello', voiceId: 'v1', outputFormat: 'mp3', maxDurationSeconds: 10 })
      expect(result.audioUrl).toBe('https://cdn/a.mp3')
      expect(result.synchronous).toBe(true)
    })

    it('throws MissingCredentialsError when apiKey absent', async () => {
      const adapter = mkAdapter(null)
      await expect(adapter.generateVoiceover({ script: 'hello', voiceId: 'v1', outputFormat: 'mp3', maxDurationSeconds: 10 })).rejects.toBeInstanceOf(MissingCredentialsError)
    })
  })

  describe('unsupported types', () => {
    it('generateTextToVideo throws', async () => {
      const adapter = mkAdapter('key')
      await expect(adapter.generateTextToVideo({ prompt: 'a cat', negativePrompt: '', durationSeconds: 5, aspectRatio: '16:9', cfgScale: 7.5 })).rejects.toThrow('text_to_video not supported')
    })
  })

  describe('getJobStatus', () => {
    it('maps done→completed, error→failed, started→processing, waiting→queued', async () => {
      const adapter = mkAdapter('key')
      for (const [status, expected] of [['done', 'completed'], ['error', 'failed'], ['started', 'processing'], ['waiting', 'queued']] as const) {
        vi.mocked(fetch).mockResolvedValue(buildResponse({ status, result_url: 'url' }))
        const r = await adapter.getJobStatus('jid')
        expect(r.status).toBe(expected)
      }
      vi.mocked(fetch).mockClear()
    })

    it('throws ProviderNetworkError on HTTP 500', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({}, 500))
      await expect(adapter.getJobStatus('jid')).rejects.toThrow('Network error')
    })
  })

  describe('cancelJob', () => {
    it('returns true on success', async () => {
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
  })

  describe('estimateCost', () => {
    it('text_to_video returns unavailable', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'text_to_video', params: { prompt: '', negativePrompt: '', durationSeconds: 5, aspectRatio: '16:9' } })
      expect(r.confidence).toBe('unavailable')
    })

    it('talking_head returns 0.05', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'talking_head', params: { script: 'hello world test', voiceId: '', avatarImageUrl: AVATAR_URL, avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 } })
      expect(r.amount).toBeCloseTo(0.05, 2)
    })

    it('voiceover returns 0.03', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'voiceover', params: { script: 'hi', voiceId: '', outputFormat: 'mp3', maxDurationSeconds: 10 } })
      expect(r.amount).toBeCloseTo(0.03, 2)
    })
  })
})
