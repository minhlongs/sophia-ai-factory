/**
 * Tests for YouTube OAuth client (auth URL, token exchange/refresh, video
 * upload via resumable flow, channel info).
 *
 * Module uses fetch() directly — tests stub global fetch + env credentials.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn().mockReturnValue(true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}))

vi.mock('@/seed/types/failure-kind', () => ({
  classifyError: vi.fn().mockReturnValue('SERVER_ERROR'),
}))

import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  uploadVideo,
  getChannelInfo,
} from './youtube-oauth-client'

const mockFetch = vi.fn()

function makeResponse(opts: {
  ok?: boolean
  status?: number
  jsonBody?: unknown
  text?: string
  headers?: Record<string, string>
  blobSize?: number
  blobType?: string
}): Response {
  const headers = new Headers(opts.headers ?? {})
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers,
    json: async () => opts.jsonBody,
    text: async () => opts.text ?? '',
    blob: async () =>
      new Blob(['x'.repeat(opts.blobSize ?? 100)], {
        type: opts.blobType ?? 'video/mp4',
      }),
  } as unknown as Response
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('YOUTUBE_CLIENT_ID', 'client-id-abc')
  vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'client-secret-xyz')
  vi.stubEnv('YOUTUBE_REDIRECT_URI', 'https://sophia.example/oauth/youtube/callback')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('getCredentials (via getAuthorizationUrl)', () => {
  it('throws when YOUTUBE_CLIENT_ID is missing', () => {
    vi.stubEnv('YOUTUBE_CLIENT_ID', '')
    expect(() => getAuthorizationUrl('s')).toThrow(/Missing YouTube OAuth credentials/)
  })

  it('throws when YOUTUBE_CLIENT_SECRET is missing', () => {
    vi.stubEnv('YOUTUBE_CLIENT_SECRET', '')
    expect(() => getAuthorizationUrl('s')).toThrow(/Missing YouTube OAuth credentials/)
  })

  it('throws when YOUTUBE_REDIRECT_URI is missing', () => {
    vi.stubEnv('YOUTUBE_REDIRECT_URI', '')
    expect(() => getAuthorizationUrl('s')).toThrow(/Missing YouTube OAuth credentials/)
  })
})

describe('getAuthorizationUrl', () => {
  it('builds Google OAuth2 URL with all required params', () => {
    const url = getAuthorizationUrl('csrf-state-token')
    const u = new URL(url)

    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(u.searchParams.get('client_id')).toBe('client-id-abc')
    expect(u.searchParams.get('redirect_uri')).toBe('https://sophia.example/oauth/youtube/callback')
    expect(u.searchParams.get('response_type')).toBe('code')
    expect(u.searchParams.get('state')).toBe('csrf-state-token')
    expect(u.searchParams.get('access_type')).toBe('offline')
    expect(u.searchParams.get('prompt')).toBe('consent')
  })

  it('requests both youtube.upload and youtube scopes', () => {
    const u = new URL(getAuthorizationUrl('x'))
    const scope = u.searchParams.get('scope') ?? ''
    expect(scope).toContain('https://www.googleapis.com/auth/youtube.upload')
    expect(scope).toContain('https://www.googleapis.com/auth/youtube')
  })
})

describe('exchangeCodeForTokens', () => {
  it('POSTs to Google token endpoint with authorization_code grant', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        jsonBody: {
          access_token: 'at-1',
          refresh_token: 'rt-1',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      })
    )

    const result = await exchangeCodeForTokens('auth-code-abc')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')

    const body = new URLSearchParams(init.body)
    expect(body.get('code')).toBe('auth-code-abc')
    expect(body.get('client_id')).toBe('client-id-abc')
    expect(body.get('client_secret')).toBe('client-secret-xyz')
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('redirect_uri')).toBe('https://sophia.example/oauth/youtube/callback')

    expect(result.access_token).toBe('at-1')
    expect(result.refresh_token).toBe('rt-1')
  })

  it('throws with status code when token exchange fails', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ ok: false, status: 400, text: 'invalid_grant' })
    )
    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow(/YouTube token exchange failed: 400/)
  })
})

describe('refreshAccessToken', () => {
  it('POSTs with refresh_token grant', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        jsonBody: { access_token: 'at-new', expires_in: 3600, token_type: 'Bearer' },
      })
    )

    const result = await refreshAccessToken('rt-stored')

    const [, init] = mockFetch.mock.calls[0]
    const body = new URLSearchParams(init.body)
    expect(body.get('refresh_token')).toBe('rt-stored')
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('client_id')).toBe('client-id-abc')
    expect(body.get('client_secret')).toBe('client-secret-xyz')
    expect(body.has('redirect_uri')).toBe(false) // refresh doesn't include redirect

    expect(result.access_token).toBe('at-new')
  })

  it('throws on non-ok refresh response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ ok: false, status: 401, text: 'invalid_refresh' })
    )
    await expect(refreshAccessToken('bad-rt')).rejects.toThrow(/YouTube token refresh failed: 401/)
  })
})

describe('uploadVideo', () => {
  const params = {
    accessToken: 'at-1',
    videoUrl: 'https://r2.example/video.mp4',
    title: 'My Video',
    description: 'A great video',
    tags: ['demo', 'test'],
  }

  it('runs the full resumable upload flow and returns the watch URL', async () => {
    // 1) Fetch video source
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        headers: { 'content-type': 'video/webm' },
        blobSize: 1024,
        blobType: 'video/webm',
      })
    )
    // 2) Init upload — returns Location header
    mockFetch.mockResolvedValueOnce(
      makeResponse({ headers: { Location: 'https://upload.example/session-id' } })
    )
    // 3) PUT video bytes — returns { id }
    mockFetch.mockResolvedValueOnce(makeResponse({ jsonBody: { id: 'YT_VIDEO_ID' } }))

    const url = await uploadVideo(params)
    expect(url).toBe('https://www.youtube.com/watch?v=YT_VIDEO_ID')

    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(mockFetch.mock.calls[0][0]).toBe(params.videoUrl)

    const initCall = mockFetch.mock.calls[1]
    expect(initCall[0]).toContain('uploadType=resumable')
    expect(initCall[1].headers.Authorization).toBe('Bearer at-1')
    const metadata = JSON.parse(initCall[1].body)
    expect(metadata.snippet.title).toBe('My Video')
    expect(metadata.snippet.tags).toEqual(['demo', 'test'])
    expect(metadata.snippet.categoryId).toBe('22')
    expect(metadata.status.privacyStatus).toBe('public')

    const putCall = mockFetch.mock.calls[2]
    expect(putCall[0]).toBe('https://upload.example/session-id')
    expect(putCall[1].method).toBe('PUT')
  })

  it('falls back to video/mp4 content-type when source omits it', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ headers: {}, blobType: '' }))
    mockFetch.mockResolvedValueOnce(makeResponse({ headers: { Location: 'https://u/x' } }))
    mockFetch.mockResolvedValueOnce(makeResponse({ jsonBody: { id: 'V' } }))

    await uploadVideo(params)
    expect(mockFetch.mock.calls[1][1].headers['X-Upload-Content-Type']).toBe('video/mp4')
  })

  it('throws when video source fetch fails', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: false, status: 404, text: 'not found' }))
    await expect(uploadVideo(params)).rejects.toThrow(/Video source fetch failed: 404/)
  })

  it('throws when upload initiation fails', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ blobSize: 10 }))
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: false, status: 500, text: 'init err' }))
    await expect(uploadVideo(params)).rejects.toThrow(/YouTube upload initiation failed: 500/)
  })

  it('throws when Location header is missing on init response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ blobSize: 10 }))
    mockFetch.mockResolvedValueOnce(makeResponse({ headers: {} }))
    await expect(uploadVideo(params)).rejects.toThrow(/did not return a resumable upload URI/)
  })

  it('throws when video PUT fails', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ blobSize: 10 }))
    mockFetch.mockResolvedValueOnce(makeResponse({ headers: { Location: 'https://u/x' } }))
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: false, status: 503, text: 'put err' }))
    await expect(uploadVideo(params)).rejects.toThrow(/YouTube video upload failed: 503/)
  })
})

describe('getChannelInfo', () => {
  it('returns channelId/title/thumbnail from items[0]', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        jsonBody: {
          items: [
            {
              id: 'UC_CHANNEL_ID',
              snippet: {
                title: 'My Channel',
                thumbnails: { default: { url: 'https://yt/thumb.jpg' } },
              },
            },
          ],
        },
      })
    )

    const info = await getChannelInfo('at-1')

    expect(info).toEqual({
      channelId: 'UC_CHANNEL_ID',
      title: 'My Channel',
      thumbnailUrl: 'https://yt/thumb.jpg',
    })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('part=snippet')
    expect(url).toContain('mine=true')
    expect(init.headers.Authorization).toBe('Bearer at-1')
  })

  it('returns empty string for thumbnailUrl when default thumbnail missing', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        jsonBody: {
          items: [
            { id: 'UC_X', snippet: { title: 'T', thumbnails: {} } },
          ],
        },
      })
    )

    const info = await getChannelInfo('at-1')
    expect(info.thumbnailUrl).toBe('')
  })

  it('throws when items array is empty or missing', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ jsonBody: { items: [] } }))
    await expect(getChannelInfo('at-1')).rejects.toThrow(/No YouTube channel found/)

    mockFetch.mockResolvedValueOnce(makeResponse({ jsonBody: {} }))
    await expect(getChannelInfo('at-1')).rejects.toThrow(/No YouTube channel found/)
  })

  it('throws when channels API returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: false, status: 401, text: 'unauth' }))
    await expect(getChannelInfo('bad-at')).rejects.toThrow(/YouTube channel info fetch failed: 401/)
  })
})
