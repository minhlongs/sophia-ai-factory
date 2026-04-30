/**
 * Tests for GET /api/cron/video-status-sync
 *
 * Covers:
 *  - Auth (401 without CRON_SECRET)
 *  - D1 unavailable (500)
 *  - No HEYGEN_API_KEY → skipped
 *  - Processing video stays processing (no DB write)
 *  - Video transitions to completed → downloadAndStore called, D1 updated with r2_key
 *  - Video transitions to completed but R2 fails → still updates D1 with null r2_key
 *  - Video timeout → marked failed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---- module mocks (must be hoisted before any import of mocked module) ----

vi.mock('@/lib/db/client', () => ({
  getD1Raw: vi.fn(),
}))

vi.mock('@/lib/heygen/heygen-client', () => ({
  getHeyGenClient: vi.fn(),
}))

vi.mock('@/lib/video/video-storage-service', () => ({
  downloadAndStore: vi.fn(),
}))

vi.mock('@/lib/cron/run-tracker', () => ({
  recordCronRun: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { GET } from './route'
import { getD1Raw } from '@/lib/db/client'
import { getHeyGenClient } from '@/lib/heygen/heygen-client'
import { downloadAndStore } from '@/lib/video/video-storage-service'

// ---- helpers ----

function buildRequest(auth?: string): NextRequest {
  const headers = new Headers(auth ? { authorization: auth } : {})
  return { headers } as unknown as NextRequest
}

/** Build a minimal mock D1 that returns `rows` from .all() */
function buildMockDb(rows: object[]) {
  const bindRun = vi.fn().mockResolvedValue(undefined)
  const bindObj = { run: bindRun }
  const bindFn = vi.fn().mockReturnValue(bindObj)
  const allFn = vi.fn().mockResolvedValue({ results: rows })
  const prepareObj = { bind: bindFn, all: allFn }
  return {
    prepare: vi.fn().mockReturnValue(prepareObj),
    _bindRun: bindRun,
    _bindFn: bindFn,
    _allFn: allFn,
  }
}

const VIDEO_ROW = {
  id: 'vid-001',
  user_id: 'user-abc',
  heygen_job_id: 'hj-111',
  created_at: new Date().toISOString(),
}

// ---- tests ----

describe('GET /api/cron/video-status-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'test-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 when auth missing in production', async () => {
    const res = await GET(buildRequest())
    expect(res.status).toBe(401)
  })

  it('returns 500 when D1 unavailable', async () => {
    vi.mocked(getD1Raw).mockRejectedValueOnce(new Error('D1 down'))
    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('db_unavailable')
  })

  it('returns skipped when HEYGEN_API_KEY missing', async () => {
    const db = buildMockDb([])
    vi.mocked(getD1Raw).mockResolvedValueOnce(db as unknown as D1Database)
    vi.mocked(getHeyGenClient).mockResolvedValueOnce(null)

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { skipped: boolean }
    expect(body.skipped).toBe(true)
  })

  it('does not update D1 when video is still processing', async () => {
    const db = buildMockDb([VIDEO_ROW])
    vi.mocked(getD1Raw).mockResolvedValueOnce(db as unknown as D1Database)
    vi.mocked(getHeyGenClient).mockResolvedValueOnce({
      getVideoStatus: vi.fn().mockResolvedValue({ status: 'processing' }),
    } as unknown as Awaited<ReturnType<typeof getHeyGenClient>>)

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { checked: number; terminal: number }
    expect(body.checked).toBe(1)
    expect(body.terminal).toBe(0)
    // prepare() called once for SELECT + once for recordCronRun prepare — not for UPDATE
    const updateCalls = db.prepare.mock.calls.filter(
      (c: string[]) => typeof c[0] === 'string' && c[0].includes('UPDATE'),
    )
    expect(updateCalls).toHaveLength(0)
  })

  it('calls downloadAndStore and writes r2_key when video completes', async () => {
    const db = buildMockDb([VIDEO_ROW])
    vi.mocked(getD1Raw).mockResolvedValueOnce(db as unknown as D1Database)
    vi.mocked(getHeyGenClient).mockResolvedValueOnce({
      getVideoStatus: vi.fn().mockResolvedValue({
        status: 'completed',
        video_url: 'https://cdn.heygen.com/video.mp4',
        thumbnail_url: null,
        error: null,
      }),
    } as unknown as Awaited<ReturnType<typeof getHeyGenClient>>)
    vi.mocked(downloadAndStore).mockResolvedValueOnce({
      permanentUrl: 'https://videos.sophia.agencyos.network/videos/user-abc/vid-001.mp4',
      bucket: 'VIDEO_BUCKET',
      path: 'videos/user-abc/vid-001.mp4',
      sizeBytes: 1024000,
    })

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { terminal: number }
    expect(body.terminal).toBe(1)

    // downloadAndStore called with correct args
    expect(vi.mocked(downloadAndStore)).toHaveBeenCalledWith(
      'https://cdn.heygen.com/video.mp4',
      VIDEO_ROW.id,
      `videos/${VIDEO_ROW.user_id}/${VIDEO_ROW.id}.mp4`,
    )

    // D1 UPDATE must include r2_key bind value
    const updatePrepare = db.prepare.mock.calls.find(
      (c: string[]) => typeof c[0] === 'string' && c[0].includes('r2_key'),
    )
    expect(updatePrepare).toBeDefined()
  })

  it('still updates D1 (r2_key null) when R2 copy fails', async () => {
    const db = buildMockDb([VIDEO_ROW])
    vi.mocked(getD1Raw).mockResolvedValueOnce(db as unknown as D1Database)
    vi.mocked(getHeyGenClient).mockResolvedValueOnce({
      getVideoStatus: vi.fn().mockResolvedValue({
        status: 'completed',
        video_url: 'https://cdn.heygen.com/video.mp4',
        thumbnail_url: null,
        error: null,
      }),
    } as unknown as Awaited<ReturnType<typeof getHeyGenClient>>)
    vi.mocked(downloadAndStore).mockRejectedValueOnce(new Error('R2 upload failed'))

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { terminal: number }
    // Still marks terminal even when R2 fails
    expect(body.terminal).toBe(1)

    // D1 UPDATE still called
    const updatePrepare = db.prepare.mock.calls.find(
      (c: string[]) => typeof c[0] === 'string' && c[0].includes('r2_key'),
    )
    expect(updatePrepare).toBeDefined()
  })

  it('marks timed-out video as failed', async () => {
    const oldRow = {
      ...VIDEO_ROW,
      created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h ago
    }
    const db = buildMockDb([oldRow])
    vi.mocked(getD1Raw).mockResolvedValueOnce(db as unknown as D1Database)
    const getVideoStatusMock = vi.fn()
    vi.mocked(getHeyGenClient).mockResolvedValueOnce({
      getVideoStatus: getVideoStatusMock,
    } as unknown as Awaited<ReturnType<typeof getHeyGenClient>>)

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { timedOut: number }
    expect(body.timedOut).toBe(1)
    // HeyGen should NOT be polled for timed-out video
    expect(getVideoStatusMock).not.toHaveBeenCalled()
  })
})
