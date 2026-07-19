import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { SadTalkerAdapter } from './sadtalker-adapter'
import { MissingCredentialsError, ProviderNetworkError } from '@/seed/services/errors'

function buildResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('SadTalkerAdapter', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  const BASE_URL = 'http://localhost:8000'
  const mkAdapter = (apiKey?: string | null) => {
    const getApiKey = (_p: string) => (apiKey === null ? undefined : apiKey ?? 'test-sad-key')
    return new SadTalkerAdapter(getApiKey, BASE_URL)
  }

  it('identity: id=sadtalker, capabilities', () => {
    const a = mkAdapter('key')
    expect(a.id).toBe('sadtalker')
    expect(a.capabilities.generationTypes).toEqual(['talking_head', 'text_to_video'])
    expect(a.capabilities.maxResolution).toBe('512x512')
    expect(a.capabilities.lipSync).toBe(true)
    expect(a.capabilities.batch).toBe(true)
  })

  const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';
const TH_ARGS = { script: 'hi', voiceId: 'v1', avatarImageUrl: `http://example.com/face.png`, avatarImageData: DATA_URL, avatarImageFormat: 'image/png', maxDurationSeconds: 10 }

  describe('generateTalkingHead', () => {
    it('throws Error (sourceImage guard) when no image provided', async () => {
      const adapter = mkAdapter('key')
      await expect(adapter.generateTalkingHead({ ...TH_ARGS, avatarImageUrl: '', avatarImageData: '' }))
        .rejects.toThrow(/avatarImageData or avatarImageUrl is required/)
    })

    it('triggers async path when maxDurationSeconds > 15', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ job_id: 'async_job_1', status: 'queued' }))
  const result = await adapter.generateTalkingHead({ ...TH_ARGS, maxDurationSeconds: 20 })
      expect(result.jobId).toBe('async_job_1')
      expect(result.synchronous).toBe(false)
      expect(result.estimatedDuration).toBe(30)
    })

    it('returns synchronous result on happy path', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ video_url: 'https://localhost:8000/out/v.mp4' }))
  const result = await adapter.generateTalkingHead(TH_ARGS)
      expect(result.videoUrl).toBe('https://localhost:8000/out/v.mp4')
      expect(result.synchronous).toBe(true)
      expect(result.estimatedDuration).toBe(10)
    })

    it('sends FormData with source_image (URL passed through)', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ video_url: 'url' }))
      await adapter.generateTalkingHead(TH_ARGS)
      const call = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
      expect(call[1]?.method).toBe('POST')
      const form = call[1]?.body as FormData
      expect(form instanceof FormData).toBe(true)
      expect(form.get('source_image') instanceof Blob).toBe(true)
    })

    it('closes timeout when response received', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ video_url: 'url' }))
      const before = Date.now()
      await adapter.generateTalkingHead(TH_ARGS)
      expect(Date.now() - before).toBeLessThan(30_000)
    })

    it('throws ProviderNetworkError on fetch failure', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'))
      await expect(adapter.generateTalkingHead(TH_ARGS)).rejects.toThrow('fetch failed')
    })
  })

  describe('generateVoiceover', () => {
    it('always throws (unsupported)', async () => {
      const adapter = mkAdapter('key')
      await expect(adapter.generateVoiceover({ script: 'hi', voiceId: 'v', outputFormat: 'mp3' }))
        .rejects.toThrow(/voiceover generation is not supported/)
    })
  })

  describe('generateTextToVideo', () => {
    it('happy path: returns job on success', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ video_url: 'https://cdn/vid.mp4' }))
      const result = await adapter.generateTextToVideo({ prompt: 'a sunset', negativePrompt: '', durationSeconds: 5, outputFormat: 'mp4', seed: 42, cfgScale: 7.5, aspectRatio: '16:9', referenceImageUrl: '' })
      expect(result.jobId).toBe('')
      expect(result.videoUrl).toBe('https://cdn/vid.mp4')
      expect(result.synchronous).toBe(true)
    })

    it('throws ProviderNetworkError when fetch rejects', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockRejectedValue(new Error('conn refused'))
      await expect(adapter.generateTextToVideo({ prompt: 'x', negativePrompt: '', durationSeconds: 2 }))
        .rejects.toThrow('conn refused')
    })

    it('clears timeout on completion', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ video_url: 'url' }))
      const before = Date.now()
      await adapter.generateTextToVideo({ prompt: 'x', negativePrompt: '' })
      expect(Date.now() - before).toBeLessThan(30_000)
    })
  })

  describe('getJobStatus', () => {
    it('maps completed with progress', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ status: 'completed', video_url: 'url', progress: 100 }))
      const r = await adapter.getJobStatus('jid_1')
      expect(r.status).toBe('completed')
      expect(r.videoUrl).toBe('url')
      expect(r.progressPercent).toBe(100)
    })

    it('maps failed with error message', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ status: 'failed', error: 'OOM' }))
      const r = await adapter.getJobStatus('jid')
      expect(r.status).toBe('failed')
      expect(r.error).toBe('OOM')
    })

    it('maps unknown status→processing', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(buildResponse({ status: 'weird_state' }))
      const r = await adapter.getJobStatus('jid')
      expect(r.status).toBe('processing')
    })

    it('throws on HTTP 500', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))
      await expect(adapter.getJobStatus('jid')).rejects.toThrow(/HTTP 500/)
    })
  })

  describe('cancelJob', () => {
    it('returns true on 200', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))
      expect(await adapter.cancelJob('jid')).toBe(true)
    })

    it('throws on 500', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))
      await expect(adapter.cancelJob('jid')).rejects.toThrow('HTTP 500')
    })
  })

  describe('healthCheck', () => {
    it('returns healthy=true on 200', async () => {
      const adapter = mkAdapter('key')
      vi.mocked(fetch).mockResolvedValue(new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } }))
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
    it('voiceover returns unavailable', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'voiceover', params: { script: 'hi', voiceId: '', outputFormat: 'mp3' } })
      expect(r.amount).toBe(0)
      expect(r.confidence).toBe('unavailable')
    })

    it('talking_head = 0.01', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'talking_head', params: { script: 'hi', voiceId: '', avatarImageUrl: 'http://example.com/face.png', avatarImageData: '', avatarImageFormat: 'image/png', maxDurationSeconds: 10 } })
      expect(r.amount).toBe(0.01)
    })

    it('text_to_video = 0.10', async () => {
      const adapter = mkAdapter('key')
      const r = await adapter.estimateCost({ type: 'text_to_video', params: { prompt: 'x', negativePrompt: '', durationSeconds: 5 } })
      expect(r.amount).toBe(0.10)
    })
  })
})
