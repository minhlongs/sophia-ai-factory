/**
 * Unit tests for video-access-control.ts
 * Verifies revoked state, ownership check, and streaming auth.
 * C4: Tests streaming approach — no presigned URL involved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(),
}))

vi.mock('../r2-binding', () => ({
  getVideoBucket: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import { authorizeVideoAccess } from '../video-access-control'
import { getD1Raw } from '@/seed/db/client'
import { getVideoBucket } from '../r2-binding'

// Mock '../r2-binding' to match the source's `./r2-binding` import

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeD1WithRow(row: Record<string, unknown> | null) {
  return {
    prepare: () => ({
      bind: () => ({
        first: vi.fn().mockResolvedValue(row),
      }),
    }),
  } as unknown as D1Database
}

function makeR2Bucket(publicBaseUrl: string | null) {
  const bucket = {
    get: vi.fn().mockResolvedValue({
      body: new ReadableStream(),
      size: 1024,
      httpMetadata: { contentType: 'video/mp4' },
    }),
  } as unknown as R2Bucket
  return { bucket, publicBaseUrl }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('authorizeVideoAccess', () => {
  const USER_ID = 'user-123'
  const VIDEO_ID = 'video-abc'
  const R2_KEY = 'videos/user-123/video-abc.mp4'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns not_found when no video row exists', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(makeD1WithRow(null))

    const result = await authorizeVideoAccess(VIDEO_ID, USER_ID)
    expect('denied' in result).toBe(true)
    if ('denied' in result) expect(result.reason).toBe('not_found')
  })

  it('returns unauthorized when user_id does not match', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(
      makeD1WithRow({ id: VIDEO_ID, user_id: 'other-user', r2_key: R2_KEY, access_revoked: 0 }),
    )

    const result = await authorizeVideoAccess(VIDEO_ID, USER_ID)
    expect('denied' in result).toBe(true)
    if ('denied' in result) expect(result.reason).toBe('unauthorized')
  })

  it('returns revoked when access_revoked = 1', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(
      makeD1WithRow({ id: VIDEO_ID, user_id: USER_ID, r2_key: R2_KEY, access_revoked: 1 }),
    )

    const result = await authorizeVideoAccess(VIDEO_ID, USER_ID)
    expect('denied' in result).toBe(true)
    if ('denied' in result) expect(result.reason).toBe('revoked')
  })

  it('returns not_ready when r2_key is null', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(
      makeD1WithRow({ id: VIDEO_ID, user_id: USER_ID, r2_key: null, access_revoked: 0 }),
    )

    const result = await authorizeVideoAccess(VIDEO_ID, USER_ID)
    expect('denied' in result).toBe(true)
    if ('denied' in result) expect(result.reason).toBe('not_ready')
  })

  it('returns r2_unavailable when R2 bucket is not available', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(
      makeD1WithRow({ id: VIDEO_ID, user_id: USER_ID, r2_key: R2_KEY, access_revoked: 0 }),
    )
    vi.mocked(getVideoBucket).mockResolvedValue(null)

    const result = await authorizeVideoAccess(VIDEO_ID, USER_ID)
    expect('denied' in result).toBe(true)
    if ('denied' in result) expect(result.reason).toBe('r2_unavailable')
  })

  it('returns granted with r2Key + bucket when all checks pass (public bucket)', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(
      makeD1WithRow({ id: VIDEO_ID, user_id: USER_ID, r2_key: R2_KEY, access_revoked: 0 }),
    )
    const bucket = makeR2Bucket('https://cdn.example.com')
    vi.mocked(getVideoBucket).mockResolvedValue(bucket)

    const result = await authorizeVideoAccess(VIDEO_ID, USER_ID)
    expect('granted' in result).toBe(true)
    if ('granted' in result) {
      expect(result.access.r2Key).toBe(R2_KEY)
      expect(result.access.publicBaseUrl).toBe('https://cdn.example.com')
    }
  })

  it('returns granted with r2Key + bucket for private bucket (streaming)', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(
      makeD1WithRow({ id: VIDEO_ID, user_id: USER_ID, r2_key: R2_KEY, access_revoked: 0 }),
    )
    const bucket = makeR2Bucket(null)
    vi.mocked(getVideoBucket).mockResolvedValue(bucket)

    const result = await authorizeVideoAccess(VIDEO_ID, USER_ID)
    expect('granted' in result).toBe(true)
    if ('granted' in result) {
      expect(result.access.r2Key).toBe(R2_KEY)
      expect(result.access.publicBaseUrl).toBeNull()
      expect(result.access.r2Bucket).toBe(bucket.bucket)
    }
  })
})
