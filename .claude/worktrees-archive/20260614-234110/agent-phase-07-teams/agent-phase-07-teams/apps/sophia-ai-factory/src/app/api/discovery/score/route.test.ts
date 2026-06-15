/**
 * Tests for POST /api/discovery/score — Phase 9B discovery score user endpoint.
 *
 * Coverage:
 *   401 when no user session
 *   400 when body has no program
 *   400 when niche missing
 *   400 when niche >200 chars
 *   400 when program.id missing
 *   200 happy path — enhancer called with (program, niche, user.id)
 *   200 happy path — track() called with DISCOVERY_SCORE_REQUESTED audit event
 *   500 when enhancer throws — logger.warn called
 *   rate-limit bucket — RATE_LIMITS.discovery exists with 30 req/min
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/tree/discovery/affiliate-openrouter-niche-enhancer', () => ({
  enhanceNicheScoreWithAI: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

vi.mock('@/land/signals/track', () => ({
  track: vi.fn(),
}))

import { POST } from './route'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { enhanceNicheScoreWithAI } from '@/tree/discovery/affiliate-openrouter-niche-enhancer'
import { logger } from '@/seed/utils/logger-utility'
import { track } from '@/land/signals/track'
import { D1Events } from '@/land/signals/d1-event-types'
import { RATE_LIMITS } from '@/seed/security/sql-rate-limiter'

const mockGetCurrentUser    = vi.mocked(getCurrentUser)
const mockEnhanceNicheScore = vi.mocked(enhanceNicheScoreWithAI)
const mockLogger            = vi.mocked(logger)
const mockTrack             = vi.mocked(track)

const USER = { id: 'user-abc' } as Awaited<ReturnType<typeof getCurrentUser>>

const VALID_PROGRAM = { id: 'prog-1', name: 'ClickBank' }
const VALID_NICHE   = 'fitness supplements'

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/discovery/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('POST /api/discovery/score', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('401 when no user session', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: VALID_NICHE }))
    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Unauthorized')
    expect(mockEnhanceNicheScore).not.toHaveBeenCalled()
  })

  it('400 when body has no program', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await POST(makeRequest({ niche: VALID_NICHE }))
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid request')
    expect(mockEnhanceNicheScore).not.toHaveBeenCalled()
  })

  it('400 when niche missing', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await POST(makeRequest({ program: VALID_PROGRAM }))
    expect(res.status).toBe(400)
    expect(mockEnhanceNicheScore).not.toHaveBeenCalled()
  })

  it('400 when niche exceeds 200 chars', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const longNiche = 'a'.repeat(201)
    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: longNiche }))
    expect(res.status).toBe(400)
    expect(mockEnhanceNicheScore).not.toHaveBeenCalled()
  })

  it('400 when program.id missing', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await POST(makeRequest({ program: { name: 'NoId' }, niche: VALID_NICHE }))
    expect(res.status).toBe(400)
    expect(mockEnhanceNicheScore).not.toHaveBeenCalled()
  })

  it('200 happy path — calls enhancer with (program, niche, user.id)', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockEnhanceNicheScore.mockResolvedValue(87)

    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: VALID_NICHE }))
    expect(res.status).toBe(200)

    const json = (await res.json()) as { score: number }
    expect(json.score).toBe(87)

    // Verify all three args — especially 3rd arg is user.id exactly
    expect(mockEnhanceNicheScore).toHaveBeenCalledWith(
      expect.objectContaining({ id: VALID_PROGRAM.id, name: VALID_PROGRAM.name }),
      VALID_NICHE,
      USER!.id,
    )
  })

  it('200 when enhancer returns null (score unavailable)', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockEnhanceNicheScore.mockResolvedValue(null)

    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: VALID_NICHE }))
    expect(res.status).toBe(200)

    const json = (await res.json()) as { score: null }
    expect(json.score).toBeNull()
  })

  it('500 when enhancer throws — logger.warn called, no score returned', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockEnhanceNicheScore.mockRejectedValue(new Error('OPENROUTER_UNAVAILABLE'))

    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: VALID_NICHE }))
    expect(res.status).toBe(500)

    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Scoring failed')

    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[discovery-score] enhanceNicheScoreWithAI failed',
      expect.objectContaining({
        userId: USER!.id,
        error:  'OPENROUTER_UNAVAILABLE',
      }),
    )
  })

  it('200 emits DISCOVERY_SCORE_REQUESTED audit event with correct props', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockEnhanceNicheScore.mockResolvedValue(72)

    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: VALID_NICHE }))
    expect(res.status).toBe(200)

    expect(mockTrack).toHaveBeenCalledWith(
      D1Events.DISCOVERY_SCORE_REQUESTED,
      USER!.id,
      {
        program_id: VALID_PROGRAM.id,
        niche_len:  VALID_NICHE.length,
        score_null: false,
      },
    )
  })

  it('rate-limit bucket — RATE_LIMITS.discovery has 30 requests per 60s', () => {
    expect(RATE_LIMITS.discovery).toBeDefined()
    expect(RATE_LIMITS.discovery.maxRequests).toBe(30)
    expect(RATE_LIMITS.discovery.windowSeconds).toBe(60)
    expect(RATE_LIMITS.discovery.identifier).toBe('discovery')
  })
})
