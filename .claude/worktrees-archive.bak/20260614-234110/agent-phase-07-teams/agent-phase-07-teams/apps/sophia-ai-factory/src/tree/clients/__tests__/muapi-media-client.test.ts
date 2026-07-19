/**
 * Tests for MuAPI media client (image/video/audio generation via muapi.ai).
 *
 * Module wraps fetch with bearer auth + camelCase ⇄ snake_case mapping.
 * These tests pin the request envelope, response mapping, and the
 * error-as-result contract (no throws — returns { success: false, error }).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  submitMediaJob,
  getJobStatus,
  isModelSupported,
  SUPPORTED_MODELS,
  type MediaGenerationRequest,
} from '../muapi-media-client'

const mockFetch = vi.fn()

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function errorResponse(status: number, text = 'error'): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => text,
  } as unknown as Response
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('MUAPI_API_KEY', 'sk-test-muapi')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('SUPPORTED_MODELS catalog', () => {
  it('has 3 media types with non-empty model lists', () => {
    expect(SUPPORTED_MODELS.image.length).toBeGreaterThan(0)
    expect(SUPPORTED_MODELS.video.length).toBeGreaterThan(0)
    expect(SUPPORTED_MODELS.audio.length).toBeGreaterThan(0)
  })
})

describe('isModelSupported', () => {
  it('returns true for known model + type', () => {
    expect(isModelSupported('image', 'flux-schnell')).toBe(true)
    expect(isModelSupported('video', 'kling-3.0')).toBe(true)
    expect(isModelSupported('audio', 'suno-v4')).toBe(true)
  })

  it('returns false for unknown model under a known type', () => {
    expect(isModelSupported('image', 'no-such-model')).toBe(false)
  })

  it('returns false for unknown media type (?? false fallback)', () => {
    expect(isModelSupported('bogus' as 'image', 'flux-schnell')).toBe(false)
  })
})

describe('submitMediaJob', () => {
  const baseReq: MediaGenerationRequest = {
    type: 'image',
    model: 'flux-schnell',
    prompt: 'a serene mountain at dawn',
  }

  it('POSTs to /generate with bearer auth + JSON body', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-1', status: 'pending', created_at: '2026-05-11T00:00:00Z' })
    )

    const result = await submitMediaJob(baseReq)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.muapi.ai/v1/generate')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer sk-test-muapi')
    expect(init.headers['Content-Type']).toBe('application/json')

    expect(result.success).toBe(true)
    expect(result.job?.id).toBe('job-1')
    expect(result.job?.status).toBe('pending')
    expect(result.job?.type).toBe('image')
    expect(result.job?.model).toBe('flux-schnell')
  })

  it('maps camelCase request fields to snake_case body', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-2', status: 'pending', created_at: 'now' })
    )

    await submitMediaJob({
      ...baseReq,
      negativePrompt: 'low quality',
      aspectRatio: '9:16',
      duration: 5,
      style: 'cinematic',
      seed: 42,
      imageUrl: 'https://example.com/ref.jpg',
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.negative_prompt).toBe('low quality')
    expect(body.aspect_ratio).toBe('9:16')
    expect(body.image_url).toBe('https://example.com/ref.jpg')
    expect(body.duration).toBe(5)
    expect(body.style).toBe('cinematic')
    expect(body.seed).toBe(42)
  })

  it('defaults aspect_ratio to 16:9 when not provided', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-3', status: 'pending', created_at: 'now' })
    )

    await submitMediaJob(baseReq)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.aspect_ratio).toBe('16:9')
  })

  it('defaults job.status to pending when API omits it', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-4', status: '', created_at: 'now' })
    )

    const result = await submitMediaJob(baseReq)
    expect(result.job?.status).toBe('pending')
  })

  it('returns error result when MUAPI_API_KEY is missing', async () => {
    vi.stubEnv('MUAPI_API_KEY', '')
    const result = await submitMediaJob(baseReq)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/MUAPI_API_KEY not configured/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns error result with status + body snippet on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429, 'rate limited'))
    const result = await submitMediaJob(baseReq)
    expect(result.success).toBe(false)
    expect(result.error).toContain('MuAPI 429')
    expect(result.error).toContain('rate limited')
  })

  it('caps body snippet at 200 chars in error message', async () => {
    const huge = 'x'.repeat(500)
    mockFetch.mockResolvedValueOnce(errorResponse(500, huge))
    const result = await submitMediaJob(baseReq)
    expect(result.success).toBe(false)
    // Should not contain all 500 x's — snippet is sliced
    const xCount = (result.error?.match(/x/g) || []).length
    expect(xCount).toBeLessThanOrEqual(200)
  })

  it('returns error result on network/throw (no exception propagated)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const result = await submitMediaJob(baseReq)
    expect(result.success).toBe(false)
    expect(result.error).toBe('network down')
  })

  it('handles unreadable error body gracefully (text() throws)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => { throw new Error('body unreadable') },
    } as unknown as Response)
    const result = await submitMediaJob(baseReq)
    expect(result.success).toBe(false)
    expect(result.error).toContain('MuAPI 503')
  })
})

describe('getJobStatus', () => {
  it('GETs /jobs/{id} with bearer auth', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: 'job-1',
        status: 'completed',
        type: 'video',
        model: 'kling-3.0',
        result_url: 'https://cdn.example/v.mp4',
        thumbnail_url: 'https://cdn.example/t.jpg',
        progress: 100,
        created_at: '2026-05-11T00:00:00Z',
        completed_at: '2026-05-11T00:05:00Z',
      })
    )

    const result = await getJobStatus('job-1')

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.muapi.ai/v1/jobs/job-1')
    expect(init.headers.Authorization).toBe('Bearer sk-test-muapi')

    expect(result.success).toBe(true)
    expect(result.job).toEqual({
      id: 'job-1',
      status: 'completed',
      type: 'video',
      model: 'kling-3.0',
      resultUrl: 'https://cdn.example/v.mp4',
      thumbnailUrl: 'https://cdn.example/t.jpg',
      progress: 100,
      error: undefined,
      createdAt: '2026-05-11T00:00:00Z',
      completedAt: '2026-05-11T00:05:00Z',
    })
  })

  it('maps snake_case API response to camelCase MediaJob', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: 'job-2',
        status: 'failed',
        type: 'image',
        model: 'flux-dev',
        error: 'NSFW content detected',
        created_at: 'now',
      })
    )

    const result = await getJobStatus('job-2')
    expect(result.job?.error).toBe('NSFW content detected')
    expect(result.job?.status).toBe('failed')
    expect(result.job?.resultUrl).toBeUndefined()
    expect(result.job?.completedAt).toBeUndefined()
  })

  it('returns error result on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404))
    const result = await getJobStatus('missing')
    expect(result.success).toBe(false)
    expect(result.error).toContain('MuAPI 404')
  })

  it('returns error result when MUAPI_API_KEY is missing', async () => {
    vi.stubEnv('MUAPI_API_KEY', '')
    const result = await getJobStatus('job-1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/MUAPI_API_KEY not configured/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns error result on network throw', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    const result = await getJobStatus('job-1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('timeout')
  })
})
