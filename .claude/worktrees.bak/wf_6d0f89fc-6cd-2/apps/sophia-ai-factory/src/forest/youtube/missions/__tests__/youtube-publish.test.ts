/**
 * Tests for youtube:publish handler — P13 multi-account wiring.
 *
 * Covers: missing params, channel lookup, disconnected channel, auto-refresh
 * (success + failure), successful upload, upload failure, decrypt failure,
 * hashtags edge cases, tenant + provider isolation, sanitized error output.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}))
vi.mock('@/tree/crypto/token-crypto', () => ({
  decryptToken: vi.fn(),
}))
vi.mock('@/forest/publishing/oauth-token-refresher', () => ({
  refreshChannelToken: vi.fn(),
}))
const uploadMock = vi.fn()
const pollStatusMock = vi.fn()
const getMetricsMock = vi.fn()
vi.mock('@/land/video/publishing/providers/youtube-publisher', () => ({
  YouTubePublisher: class {
    upload = uploadMock
    pollStatus = pollStatusMock
    getMetrics = getMetricsMock
  },
}))

import { createServerClient } from '@/seed/db/client'
import { decryptToken } from '@/tree/crypto/token-crypto'
import { refreshChannelToken } from '@/forest/publishing/oauth-token-refresher'
import { handle } from '../youtube-publish';

const mockClient = createServerClient as ReturnType<typeof vi.fn>
const mockDecrypt = decryptToken as ReturnType<typeof vi.fn>
const mockRefresh = refreshChannelToken as ReturnType<typeof vi.fn>

interface EqCall { arg0: unknown; arg1: unknown }
const eqCalls: EqCall[] = []

/**
 * Builds a db mock that handles BOTH chain depths used by the handler:
 *   - Lookup: from().select().eq().eq().eq().single()
 *   - Refresh re-read: from().select().eq().single()
 * Each .single() consumes the next entry in `rowSequence`.
 */
function buildDbMock(rowSequence: Array<unknown | null>) {
  eqCalls.length = 0
  let idx = 0
  const nextSingle = () =>
    vi.fn().mockImplementation(() => Promise.resolve({ data: rowSequence[idx++] ?? null, error: null }))

  const makeEqNode = (): { eq: ReturnType<typeof vi.fn>; single: ReturnType<typeof vi.fn> } => {
    const node: { eq: ReturnType<typeof vi.fn>; single: ReturnType<typeof vi.fn> } = {
      eq: vi.fn(),
      single: nextSingle(),
    }
    node.eq.mockImplementation((arg0: unknown, arg1: unknown) => {
      eqCalls.push({ arg0, arg1 })
      return makeEqNode()
    })
    return node
  }

  const select = vi.fn().mockImplementation(() => {
    const root = makeEqNode()
    return { eq: root.eq }
  })
  const from = vi.fn().mockReturnValue({ select })
  return { from }
}

const longExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600 // 7 days from now

const activeChannel = {
  id: 'pc-1',
  external_account_id: 'UC1',
  display_name: 'Primary',
  status: 'active',
  access_token: 'enc_token',
  expires_at: longExpiry,
  refresh_token: 'enc_refresh',
  provider: 'youtube',
  tenant_id: 'u-1',
  user_id: 'u-1',
  created_at: 0,
  updated_at: 0,
}

const baseCtx = {
  missionId: 'm-1',
  userId: 'u-1',
  command: 'youtube:publish',
  params: {
    video_url: 'https://r2.example/video.mp4',
    channel_id: 'pc-1',
    title: 'Hello World',
    description: 'desc',
  },
}

describe('youtube:publish handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uploadMock.mockReset()
    mockRefresh.mockReset()
  })

  it('rejects when video_url missing', async () => {
    const result = await handle({ ...baseCtx, params: { channel_id: 'pc-1' } })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('missing_video_url')
  })

  it('rejects when channel_id missing', async () => {
    const result = await handle({ ...baseCtx, params: { video_url: 'https://x/y.mp4' } })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('missing_channel_id')
    expect(result.data?.hint).toContain('youtube:list-channels')
  })

  it('rejects when channel not found', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([null]))
    const result = await handle(baseCtx)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('channel_not_found')
  })

  it('rejects when channel disconnected', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([{ ...activeChannel, status: 'disconnected' }]))
    const result = await handle(baseCtx)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('channel_disconnected')
    expect(result.data?.status).toBe('disconnected')
  })

  it('auto-refreshes when token expires within 1 hour', async () => {
    const soonExpiry = Math.floor(Date.now() / 1000) + 600 // 10 min from now
    mockClient.mockReturnValueOnce(buildDbMock([
      { ...activeChannel, expires_at: soonExpiry },
      { access_token: 'enc_token_new' }, // refresh re-read
    ]))
    mockRefresh.mockResolvedValueOnce(longExpiry)
    mockDecrypt.mockResolvedValueOnce('ya29.refreshed_token')
    uploadMock.mockResolvedValueOnce('YT_REFRESHED_ID')

    const result = await handle(baseCtx)
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(mockDecrypt).toHaveBeenCalledWith('enc_token_new')
    expect(result.ok).toBe(true)
    expect(result.data?.external_post_id).toBe('YT_REFRESHED_ID')
  })

  it('returns token_refresh_failed when refresh throws', async () => {
    const expiredAlready = Math.floor(Date.now() / 1000) - 100
    mockClient.mockReturnValueOnce(buildDbMock([{ ...activeChannel, expires_at: expiredAlready }]))
    mockRefresh.mockRejectedValueOnce(new Error('refresh denied'))

    const result = await handle(baseCtx)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('token_refresh_failed')
    expect(result.data?.hint).toContain('Reconnect YouTube')
  })

  it('uploads successfully and returns watch_url', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([activeChannel]))
    mockDecrypt.mockResolvedValueOnce('ya29.actual_token')
    uploadMock.mockResolvedValueOnce('YT_VIDEO_ID_xyz')

    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    expect(result.data?.external_post_id).toBe('YT_VIDEO_ID_xyz')
    expect(result.data?.watch_url).toBe('https://www.youtube.com/watch?v=YT_VIDEO_ID_xyz')
    expect(result.data?.channel_id).toBe('UC1')
    expect(result.data?.channel_title).toBe('Primary')
    expect(uploadMock).toHaveBeenCalledWith(
      'https://r2.example/video.mp4',
      expect.objectContaining({ caption: 'desc', title: 'Hello World', hashtags: [] }),
    )
  })

  it('returns null watch_url when publisher is in mock mode', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([activeChannel]))
    mockDecrypt.mockResolvedValueOnce('mock_token')
    uploadMock.mockResolvedValueOnce('mock_youtube_12345')

    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    expect(result.data?.external_post_id).toBe('mock_youtube_12345')
    expect(result.data?.watch_url).toBeNull()
  })

  it('returns youtube_upload_failed with sanitized message on upload error', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([activeChannel]))
    mockDecrypt.mockResolvedValueOnce('ya29.token')
    uploadMock.mockRejectedValueOnce(new Error('Auth Bearer ya29.SECRETvalue rejected'))

    const result = await handle(baseCtx)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('youtube_upload_failed')
    const message = result.data?.message as string
    expect(message).toContain('Bearer [REDACTED]')
    expect(message).not.toContain('ya29.SECRETvalue')
  })

  it('returns token_decrypt_failed when decryption throws', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([{ ...activeChannel, access_token: 'corrupted' }]))
    mockDecrypt.mockRejectedValueOnce(new Error('decrypt failed'))

    const result = await handle(baseCtx)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('token_decrypt_failed')
  })

  it('forwards hashtags array to publisher', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([activeChannel]))
    mockDecrypt.mockResolvedValueOnce('ya29.token')
    uploadMock.mockResolvedValueOnce('YT_X')

    await handle({ ...baseCtx, params: { ...baseCtx.params, hashtags: ['sophia', 'raas', 'ai'] } })
    expect(uploadMock).toHaveBeenCalledWith(
      'https://r2.example/video.mp4',
      expect.objectContaining({ hashtags: ['sophia', 'raas', 'ai'] }),
    )
  })

  it('coerces non-array hashtags param to empty array', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([activeChannel]))
    mockDecrypt.mockResolvedValueOnce('ya29.token')
    uploadMock.mockResolvedValueOnce('YT_X')

    await handle({ ...baseCtx, params: { ...baseCtx.params, hashtags: 'not-an-array' } })
    expect(uploadMock).toHaveBeenCalledWith(
      'https://r2.example/video.mp4',
      expect.objectContaining({ hashtags: [] }),
    )
  })

  it('filters by tenant_id AND provider=youtube (tenant + provider isolation)', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([null]))
    await handle({ ...baseCtx, userId: 'attacker', params: { ...baseCtx.params, channel_id: 'victim-channel' } })
    const tenantCall = eqCalls.find((c) => c.arg0 === 'tenant_id')
    const providerCall = eqCalls.find((c) => c.arg0 === 'provider')
    const idCall = eqCalls.find((c) => c.arg0 === 'id')
    expect(tenantCall?.arg1).toBe('attacker')
    expect(providerCall?.arg1).toBe('youtube')
    expect(idCall?.arg1).toBe('victim-channel')
  })
})
