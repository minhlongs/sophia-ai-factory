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

const mockSingle = vi.fn()
const mockFrom = vi.fn((table: string) => {
  if (table === 'user_purchases') {
    return {
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }
  }
  return {
    select: () => ({
      eq: () => ({
        single: vi.fn().mockResolvedValue({
          data: { email: 'user@example.com', locale: 'en' },
          error: null,
        }),
      }),
    }),
  }
})

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockReturnValue({ prepare: vi.fn() }),
  createServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

vi.mock('@/land/heygen/heygen-client', () => ({
  getHeyGenClient: vi.fn(),
}))

vi.mock('@/land/video/video-storage-service', () => ({
  downloadAndStore: vi.fn(),
}))

vi.mock('@/land/cron/run-tracker', () => ({
  recordCronRun: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/land/fulfillment/compensation', () => ({
  grantCompensationCredit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/land/billing/email/send-bundle-render-failed-email', () => ({
  sendBundleRenderFailedEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/land/billing/email/send-one-time-bundle-ready-email', () => ({
  sendOneTimeBundleReadyEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/land/r2/video-cleanup', () => ({
  deleteR2VideoArtifacts: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/seed/db/get-user-credits', () => ({
  getUserCredits: vi.fn().mockResolvedValue({ creditsRemaining: 5, expiresAt: null }),
}))

import { GET } from './route'
import { getD1, createServerClient } from '@/seed/db/client'
import { getHeyGenClient } from '@/land/heygen/heygen-client'
import { downloadAndStore } from '@/land/video/video-storage-service'
import { grantCompensationCredit } from '@/land/fulfillment/compensation'
import { sendBundleRenderFailedEmail } from '@/land/billing/email/send-bundle-render-failed-email'

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
  created_at: Math.floor(Date.now() / 1000),
}

// ---- tests ----

describe('GET /api/cron/video-status-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'test-secret')
    mockSingle.mockResolvedValue({
      data: { status: 'paid', user_id: 'user-abc', credits_remaining: 10 },
      error: null,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 when auth missing in production', async () => {
    const res = await GET(buildRequest())
    expect(res.status).toBe(401)
  })

  it('returns 500 when D1 unavailable', async () => {
    vi.mocked(getD1).mockReturnValueOnce(null)
    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('db_unavailable')
  })

  it('returns ok with errors when user has no HeyGen key', async () => {
    // Per-row BYOK: each row resolves its own key; null means skip that row
    const db = buildMockDb([VIDEO_ROW])
    vi.mocked(getD1).mockReturnValueOnce(db as unknown as D1Database)
    vi.mocked(getHeyGenClient).mockResolvedValueOnce(null) // user has no key

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { errors: number; checked: number }
    expect(body.checked).toBe(1)
    expect(body.errors).toBe(1)
  })

  it('does not update D1 when video is still processing', async () => {
    const db = buildMockDb([VIDEO_ROW])
    vi.mocked(getD1).mockReturnValueOnce(db as unknown as D1Database)
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
    vi.mocked(getD1).mockReturnValueOnce(db as unknown as D1Database)
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
    vi.mocked(getD1).mockReturnValueOnce(db as unknown as D1Database)
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
      created_at: Math.floor((Date.now() - 25 * 60 * 60 * 1000) / 1000), // 25h ago
    }
    const db = buildMockDb([oldRow])
    vi.mocked(getD1).mockReturnValueOnce(db as unknown as D1Database)

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { timedOut: number }
    expect(body.timedOut).toBe(1)
    // HeyGen should NOT be polled for timed-out video
    expect(vi.mocked(getHeyGenClient)).not.toHaveBeenCalled()
  })

  it('handles permanent failure for one-time bundle with paid status (grants compensation & sends email)', async () => {
    const bundleRow = {
      ...VIDEO_ROW,
      purchase_id: 'purch-paid-001',
    }
    const db = buildMockDb([bundleRow])
    vi.mocked(getD1).mockReturnValueOnce(db as unknown as D1Database)
    vi.mocked(getHeyGenClient).mockResolvedValueOnce({
      getVideoStatus: vi.fn().mockResolvedValue({
        status: 'failed',
        error: 'heygen_failed_reason',
      }),
    } as unknown as Awaited<ReturnType<typeof getHeyGenClient>>)

    mockSingle.mockResolvedValueOnce({
      data: { status: 'paid', user_id: 'user-abc', credits_remaining: 10 },
      error: null,
    })

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)

    // Verify D1 updated to failed_permanent
    const updateCall = db.prepare.mock.calls.find(
      (c: string[]) => typeof c[0] === 'string' && c[0].includes('failed_permanent'),
    )
    expect(updateCall).toBeDefined()

    // Verify grantCompensationCredit called
    expect(vi.mocked(grantCompensationCredit)).toHaveBeenCalledWith('purch-paid-001', 'heygen_failed_reason')
    
    // Verify email sent
    expect(vi.mocked(sendBundleRenderFailedEmail)).toHaveBeenCalledWith({
      userEmail: 'user@example.com',
      userId: 'user-abc',
      purchaseId: 'purch-paid-001',
      locale: 'en',
    })
  })

  it('handles permanent failure for one-time bundle with refunded status (skips compensation & email)', async () => {
    const bundleRow = {
      ...VIDEO_ROW,
      purchase_id: 'purch-refunded-001',
    }
    const db = buildMockDb([bundleRow])
    vi.mocked(getD1).mockReturnValueOnce(db as unknown as D1Database)
    vi.mocked(getHeyGenClient).mockResolvedValueOnce({
      getVideoStatus: vi.fn().mockResolvedValue({
        status: 'failed',
        error: 'heygen_failed_reason',
      }),
    } as unknown as Awaited<ReturnType<typeof getHeyGenClient>>)

    mockSingle.mockResolvedValueOnce({
      data: { status: 'refunded', user_id: 'user-abc', credits_remaining: 0 },
      error: null,
    })

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)

    // Verify D1 updated to failed_permanent
    const updateCall = db.prepare.mock.calls.find(
      (c: string[]) => typeof c[0] === 'string' && c[0].includes('failed_permanent'),
    )
    expect(updateCall).toBeDefined()

    // Verify grantCompensationCredit was NOT called
    expect(vi.mocked(grantCompensationCredit)).not.toHaveBeenCalled()
    
    // Verify email was NOT sent
    expect(vi.mocked(sendBundleRenderFailedEmail)).not.toHaveBeenCalled()
  })
})
