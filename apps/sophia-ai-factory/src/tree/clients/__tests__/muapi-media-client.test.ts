/**
 * Tests for MuAPI media client (image/video/audio generation via muapi.ai).
 *
 * Module wraps fetch with explicit `MuApiFunding` bearer auth + camelCase ⇄ snake_case mapping.
 * These tests pin:
 * - the explicit `MuApiFunding` transport contract (no silent `process.env.MUAPI_API_KEY` fallback),
 * - runtime rejection of missing/null/inherited/blank funding before circuit breaker or `fetch()`,
 * - request envelope, response mapping, and error-as-result contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import * as circuitBreaker from '@/seed/security/circuit-breaker'
import {
  submitMediaJob,
  getJobStatus,
  resolveMuApiFunding,
  isModelSupported,
  SUPPORTED_MODELS,
  type MediaGenerationRequest,
  type MuApiFunding,
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

const PLATFORM_FUNDING: MuApiFunding = { fund: 'platform' }
const BYOK_FUNDING: MuApiFunding = { fund: 'byok', apiKey: 'sk-customer-byok-key' }

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockReset()
  circuitBreaker.memoryCache.clear()
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('MUAPI_API_KEY', 'sk-operator-platform-secret')
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

describe('resolveMuApiFunding transport invariant', () => {
  it('accepts { fund: "byok", apiKey } and trims surrounding whitespace without reading MUAPI_API_KEY', () => {
    vi.stubEnv('MUAPI_API_KEY', '')
    expect(resolveMuApiFunding({ fund: 'byok', apiKey: '  sk-byok-trimmed  ' })).toEqual({
      ok: true,
      apiKey: 'sk-byok-trimmed',
      fund: 'byok',
    })
  })

  it('rejects empty or whitespace-only BYOK apiKey with NO_API_KEY even when MUAPI_API_KEY is set', () => {
    expect(resolveMuApiFunding({ fund: 'byok', apiKey: '' })).toEqual({
      ok: false,
      code: 'NO_API_KEY',
      error: 'MuAPI BYOK apiKey is required',
    })
    expect(resolveMuApiFunding({ fund: 'byok', apiKey: '   \t\n  ' })).toEqual({
      ok: false,
      code: 'NO_API_KEY',
      error: 'MuAPI BYOK apiKey is required',
    })
  })

  it('resolves { fund: "platform" } from MUAPI_API_KEY and fails closed when blank', () => {
    expect(resolveMuApiFunding({ fund: 'platform' })).toEqual({
      ok: true,
      apiKey: 'sk-operator-platform-secret',
      fund: 'platform',
    })

    vi.stubEnv('MUAPI_API_KEY', '   ')
    expect(resolveMuApiFunding({ fund: 'platform' })).toEqual({
      ok: false,
      code: 'NO_API_KEY',
      error: 'MUAPI_API_KEY not configured',
    })
  })

  const inheritedFundObject = Object.create({ fund: 'platform' }) as MuApiFunding

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['plain string key', 'sk-raw-string'],
    ['empty object', {}],
    ['inherited fund on prototype', inheritedFundObject],
    ['__proto__ discriminant', { fund: '__proto__' }],
    ['constructor discriminant', { fund: 'constructor' }],
    ['toString discriminant', { fund: 'toString' }],
    ['unknown discriminant', { fund: 'operator' }],
  ])('rejects malformed runtime funding (%s) with INVALID_FUNDING', (_label, badFunding) => {
    const res = resolveMuApiFunding(badFunding as MuApiFunding)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe('INVALID_FUNDING')
    }
  })
})

describe('submitMediaJob', () => {
  const baseReq: MediaGenerationRequest = {
    type: 'image',
    model: 'flux-schnell',
    prompt: 'a serene mountain at dawn',
  }

  it('POSTs to /generate with customer BYOK bearer auth instead of MUAPI_API_KEY', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-byok', status: 'pending', created_at: '2026-05-11T00:00:00Z' }),
    )

    const result = await submitMediaJob(baseReq, BYOK_FUNDING)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.muapi.ai/v1/generate')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer sk-customer-byok-key')
    expect(init.headers['Content-Type']).toBe('application/json')

    expect(result.success).toBe(true)
    expect(result.job?.id).toBe('job-byok')
    expect(result.job?.status).toBe('pending')
    expect(result.job?.type).toBe('image')
    expect(result.job?.model).toBe('flux-schnell')
  })

  it('POSTs with MUAPI_API_KEY when caller explicitly passes { fund: "platform" }', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-1', status: 'pending', created_at: '2026-05-11T00:00:00Z' }),
    )

    const result = await submitMediaJob(baseReq, PLATFORM_FUNDING)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer sk-operator-platform-secret')
    expect(result.success).toBe(true)
  })

  it('rejects omitted or blank funding before circuit breaker and before fetch, even when MUAPI_API_KEY is set', async () => {
    const breakerSpy = vi.spyOn(circuitBreaker, 'shouldAllowRequest')

    const missingFunding = await (submitMediaJob as unknown as (r: MediaGenerationRequest) => Promise<{
      success: boolean
      code?: string
    }>)(baseReq)
    expect(missingFunding.success).toBe(false)
    expect(missingFunding.code).toBe('INVALID_FUNDING')

    const blankByok = await submitMediaJob(baseReq, { fund: 'byok', apiKey: '   ' })
    expect(blankByok.success).toBe(false)
    expect(blankByok.code).toBe('NO_API_KEY')

    expect(breakerSpy).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    breakerSpy.mockRestore()
  })

  it('maps camelCase request fields to snake_case body', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-2', status: 'pending', created_at: 'now' }),
    )

    await submitMediaJob(
      {
        ...baseReq,
        negativePrompt: 'low quality',
        aspectRatio: '9:16',
        duration: 5,
        style: 'cinematic',
        seed: 42,
        imageUrl: 'https://example.com/ref.jpg',
      },
      BYOK_FUNDING,
    )

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
      jsonResponse({ id: 'job-3', status: 'pending', created_at: 'now' }),
    )

    await submitMediaJob(baseReq, BYOK_FUNDING)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.aspect_ratio).toBe('16:9')
  })

  it('defaults job.status to pending when API omits it', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-4', status: '', created_at: 'now' }),
    )

    const result = await submitMediaJob(baseReq, BYOK_FUNDING)
    expect(result.job?.status).toBe('pending')
  })

  it('returns error result when { fund: "platform" } is used without MUAPI_API_KEY', async () => {
    vi.stubEnv('MUAPI_API_KEY', '')
    const result = await submitMediaJob(baseReq, PLATFORM_FUNDING)
    expect(result.success).toBe(false)
    expect(result.code).toBe('NO_API_KEY')
    expect(result.error).toMatch(/MUAPI_API_KEY not configured/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns error result with status + body snippet on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429, 'rate limited'))
    const result = await submitMediaJob(baseReq, BYOK_FUNDING)
    expect(result.success).toBe(false)
    expect(result.error).toContain('MuAPI 429')
    expect(result.error).toContain('rate limited')
  })

  it('caps body snippet at 200 chars in error message', async () => {
    const huge = 'x'.repeat(500)
    mockFetch.mockResolvedValueOnce(errorResponse(500, huge))
    const result = await submitMediaJob(baseReq, BYOK_FUNDING)
    expect(result.success).toBe(false)
    const xCount = (result.error?.match(/x/g) || []).length
    expect(xCount).toBeLessThanOrEqual(200)
  })

  it('returns error result on network/throw (no exception propagated)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const result = await submitMediaJob(baseReq, BYOK_FUNDING)
    expect(result.success).toBe(false)
    expect(result.error).toBe('network down')
  })

  it('handles unreadable error body gracefully (text() throws)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => {
        throw new Error('body unreadable')
      },
    } as unknown as Response)
    const result = await submitMediaJob(baseReq, BYOK_FUNDING)
    expect(result.success).toBe(false)
    expect(result.error).toContain('MuAPI 503')
  })

  it('fails closed with INVALID_PROVIDER_RESPONSE when upstream 200 payload omits job id', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'pending' }))
    const result = await submitMediaJob(baseReq, BYOK_FUNDING)
    expect(result.success).toBe(false)
    expect(result.code).toBe('INVALID_PROVIDER_RESPONSE')
  })

  it('isolates circuit-breaker state per BYOK key fingerprint so Tenant A failures never block Tenant B', async () => {
    circuitBreaker.memoryCache.clear()
    const tenantA: MuApiFunding = { fund: 'byok', apiKey: 'sk-tenant-a-isolated' }
    const tenantB: MuApiFunding = { fund: 'byok', apiKey: 'sk-tenant-b-healthy' }

    for (let i = 0; i < 5; i++) {
      mockFetch.mockRejectedValueOnce(new Error('timeout'))
      await submitMediaJob(baseReq, tenantA)
    }

    const blockedA = await submitMediaJob(baseReq, tenantA)
    expect(blockedA.success).toBe(false)
    expect(blockedA.error).toContain('Circuit breaker open')

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-b', status: 'pending', created_at: '2026-11-14T00:00:00Z' }),
    )
    const allowedB = await submitMediaJob(baseReq, tenantB)
    expect(allowedB.success).toBe(true)
    expect(allowedB.job?.id).toBe('job-b')
    circuitBreaker.memoryCache.clear()
  })
})

describe('getJobStatus', () => {
  it('GETs /jobs/{id} with customer BYOK bearer auth instead of MUAPI_API_KEY', async () => {
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
      }),
    )

    const result = await getJobStatus('job-1', BYOK_FUNDING)

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.muapi.ai/v1/jobs/job-1')
    expect(init.headers.Authorization).toBe('Bearer sk-customer-byok-key')

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

  it('rejects omitted or blank funding before circuit breaker and before fetch, even when MUAPI_API_KEY is set', async () => {
    const breakerSpy = vi.spyOn(circuitBreaker, 'shouldAllowRequest')

    const missingFunding = await (getJobStatus as unknown as (id: string) => Promise<{
      success: boolean
      code?: string
    }>)('job-1')
    expect(missingFunding.success).toBe(false)
    expect(missingFunding.code).toBe('INVALID_FUNDING')

    const blankByok = await getJobStatus('job-1', { fund: 'byok', apiKey: '' })
    expect(blankByok.success).toBe(false)
    expect(blankByok.code).toBe('NO_API_KEY')

    expect(breakerSpy).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    breakerSpy.mockRestore()
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
      }),
    )

    const result = await getJobStatus('job-2', BYOK_FUNDING)
    expect(result.job?.error).toBe('NSFW content detected')
    expect(result.job?.status).toBe('failed')
    expect(result.job?.resultUrl).toBeUndefined()
    expect(result.job?.completedAt).toBeUndefined()
  })

  it('returns error result on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404))
    const result = await getJobStatus('missing', BYOK_FUNDING)
    expect(result.success).toBe(false)
    expect(result.error).toContain('MuAPI 404')
  })

  it('returns error result when { fund: "platform" } is used without MUAPI_API_KEY', async () => {
    vi.stubEnv('MUAPI_API_KEY', '')
    const result = await getJobStatus('job-1', PLATFORM_FUNDING)
    expect(result.success).toBe(false)
    expect(result.code).toBe('NO_API_KEY')
    expect(result.error).toMatch(/MUAPI_API_KEY not configured/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns error result on network throw', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    const result = await getJobStatus('job-1', BYOK_FUNDING)
    expect(result.success).toBe(false)
    expect(result.error).toBe('timeout')
  })

  it.each(['', '   ', '../account', 'job/../../secret', 'job?admin=1', 'job#frag', '..'])(
    'rejects unsafe jobId (%s) with INVALID_JOB_ID before fetch()',
    async (badJobId) => {
      const result = await getJobStatus(badJobId, BYOK_FUNDING)
      expect(result.success).toBe(false)
      expect(result.code).toBe('INVALID_JOB_ID')
      expect(mockFetch).not.toHaveBeenCalled()
    },
  )

  it('normalizes upstream cancelled/canceled statuses to failed and rejects unknown status values', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: 'job-cancelled',
        status: 'cancelled',
        type: 'video',
        model: 'kling-3.0',
        created_at: 'now',
      }),
    )
    const cancelledRes = await getJobStatus('job-cancelled', BYOK_FUNDING)
    expect(cancelledRes.success).toBe(true)
    expect(cancelledRes.job?.status).toBe('failed')

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: 'job-weird',
        status: 'mystery_state',
        type: 'video',
        model: 'kling-3.0',
        created_at: 'now',
      }),
    )
    const weirdRes = await getJobStatus('job-weird', BYOK_FUNDING)
    expect(weirdRes.success).toBe(false)
    expect(weirdRes.code).toBe('INVALID_PROVIDER_RESPONSE')
  })
})
